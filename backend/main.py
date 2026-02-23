from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import asyncio
import traceback
import time
from typing import Optional, List, Dict, Any, Tuple

from core.environment import Environment, CellType, Action, RewardStrategy
from core.agent import QLearningAgent, Algorithm

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global State
class SimulationState:
    def __init__(self):
        self.env = Environment(8, 8)
        self.agent = QLearningAgent()
        self.agent_pos = self.env.get_start_position()
        self.is_running = False
        self.speed_ms = 100
        self.episode = 0
        self.steps = 0
        self.total_reward = 0.0
        self.step_penalty = -1.0
        self.strategy = RewardStrategy.MINIMIZE_STEPS
        self.allowed_actions = Action.all_actions()
        self.last_broadcast_time = 0.0
        
        # We store connections for broadcasting
        self.connections: List[WebSocket] = []

state = SimulationState()

class SetupRequest(BaseModel):
    width: int
    height: int
    cells: Optional[List[List[str]]] = None
    alpha: float = 0.1
    gamma: float = 0.9
    epsilon: float = 0.2
    epsilon_decay: float = 0.995
    min_epsilon: float = 0.01
    algorithm: Algorithm = Algorithm.Q_LEARNING
    step_penalty: float = -1.0
    strategy: RewardStrategy = RewardStrategy.MINIMIZE_STEPS
    allowed_actions: Optional[List[Action]] = None

@app.post("/api/setup")
async def setup_simulation(req: SetupRequest):
    state.env = Environment(req.width, req.height, cells=req.cells, strategy=req.strategy)
    state.agent = QLearningAgent(
        alpha=req.alpha,
        gamma=req.gamma,
        epsilon=req.epsilon,
        epsilon_decay=req.epsilon_decay,
        min_epsilon=req.min_epsilon,
        algorithm=req.algorithm,
        allowed_actions=req.allowed_actions
    )
    state.step_penalty = req.step_penalty
    state.strategy = req.strategy
    state.allowed_actions = req.allowed_actions if req.allowed_actions else Action.all_actions()
    state.agent_pos = state.env.get_start_position()
    state.episode = 0
    state.steps = 0
    state.total_reward = 0.0
    state.is_running = False
    return {"status": "ok", "message": "Simulation configured"}

@app.put("/api/config")
async def update_config(req: SetupRequest):
    """Updates configuration without a full agent reset (preserves Q-table)"""
    state.strategy = req.strategy
    state.step_penalty = req.step_penalty
    state.allowed_actions = req.allowed_actions if req.allowed_actions else Action.all_actions()
    
    # Update agent instance
    state.agent.alpha = req.alpha
    state.agent.gamma = req.gamma
    state.agent.epsilon = req.epsilon
    state.agent.epsilon_decay = req.epsilon_decay
    state.agent.min_epsilon = req.min_epsilon
    state.agent.algorithm = req.algorithm
    state.agent.actions = state.allowed_actions
    
    # Update environment strategy
    state.env.strategy = req.strategy
    
    return {"status": "ok", "message": "Config updated"}

@app.get("/api/state")
async def get_state() -> Dict[str, Any]:
    # Convert tuple keys AND action keys to strings for JSON serialization
    q_table_serializable = {
        f"{k[0]},{k[1]}": {a.value if hasattr(a, 'value') else str(a): v for a, v in q_vals.items()}
        for k, q_vals in state.agent.q_table.items()
    }
    return {
        "env": state.env.to_dict(),
        "agent_pos": {"x": state.agent_pos[0], "y": state.agent_pos[1]},
        "q_table": q_table_serializable,
        "episode": state.episode,
        "steps": state.steps,
        "total_reward": state.total_reward,
        "epsilon": state.agent.epsilon
    }

async def _perform_step() -> Tuple[bool, Optional[Dict[str, Any]]]:
    """Returns (is_terminal, delta_info)"""
    x, y = state.agent_pos
    
    # Stuck Detection: if agent has no viable moves, end episode with penalty
    if state.env.is_stuck(x, y, state.allowed_actions):
        # Pick any allowed action to perform a terminal update
        fallback_action = state.allowed_actions[0] if state.allowed_actions else Action.RIGHT
        state.agent.update_q_value(x, y, fallback_action, -100.0, x, y, True)
        state.total_reward -= 100.0
        return True, {"pos": {"x": x, "y": y}, "q_values": state.agent.q_table.get((x, y)), "stuck": True}

    # 1. Choose action
    action, is_random, q_val = state.agent.choose_action(x, y)
    
    # 2. Simulate step
    next_x, next_y, reward, is_terminal, hit_wall, cell_type = state.env.simulate_step(x, y, action, step_penalty=state.step_penalty)
    
    # 3. If SARSA, choose next action.
    next_action = None
    if not is_terminal and state.agent.algorithm == Algorithm.SARSA:
        next_action, _, _ = state.agent.choose_action(next_x, next_y)
        
    # 4. Update Q-value
    state.agent.update_q_value(x, y, action, reward, next_x, next_y, is_terminal, next_action)
    
    # 5. Move agent
    state.agent_pos = (next_x, next_y)
    state.steps += 1
    state.total_reward += reward
    
    # Delta info for this step
    delta = {
        "pos": {"x": x, "y": y},
        "q_values": state.agent.q_table.get((x, y)),
        "collected": (next_x, next_y) if cell_type == CellType.BONUS else None
    }
    
    return is_terminal, delta

@app.post("/api/step")
async def manual_step():
    """Performs a single simulation step manually"""
    state.is_running = False # pause UI loop
    
    # Check if we are already at a terminal cell (Target or Trap)
    curr_x, curr_y = state.agent_pos
    curr_cell = state.env.get_cell(curr_x, curr_y)
    
    if curr_cell in [CellType.TARGET, CellType.TRAP]:
        # Perform reset to start
        state.agent.decay_epsilon()
        state.episode += 1
        old_reward = state.total_reward
        state.total_reward = 0.0
        state.steps = 0
        state.agent_pos = state.env.get_start_position()
        state.env.reset_to_initial()
        return {"status": "reset", "episode_reward": old_reward}

    is_terminal, delta = await _perform_step()
    return {"status": "terminal" if is_terminal else "step"}

@app.post("/api/turbo")
async def run_turbo(episodes: int = 1000):
    """Run many episodes synchronously without UI delay"""
    state.is_running = False # pause UI loop
    
    learning_curve = []
    
    for ep in range(episodes):
        is_terminal = False
        state.env.reset_to_initial() # Ensure bonuses are present
        state.agent_pos = state.env.get_start_position()
        ep_reward = 0
        count = 0
        
        while not is_terminal and count < 100000: # safety limit
            x, y = state.agent_pos
            
            # Stuck Detection
            if state.env.is_stuck(x, y, state.allowed_actions):
                fallback_action = state.allowed_actions[0] if state.allowed_actions else Action.RIGHT
                state.agent.update_q_value(x, y, fallback_action, -100.0, x, y, True)
                ep_reward -= 100.0
                is_terminal = True
                break

            action, _, _ = state.agent.choose_action(x, y)
            next_x, next_y, reward, term, _, _ = state.env.simulate_step(x, y, action, step_penalty=state.step_penalty)
            
            next_action = None
            if not term and state.agent.algorithm == Algorithm.SARSA:
                next_action, _, _ = state.agent.choose_action(next_x, next_y)
                
            state.agent.update_q_value(x, y, action, reward, next_x, next_y, term, next_action)
            state.agent_pos = (next_x, next_y)
            ep_reward += reward
            is_terminal = term
            count += 1
            
        state.agent.decay_epsilon()
        state.episode += 1
        
        # sample 100 points for the learning curve to avoid massive payload
        if episodes <= 200 or ep % (episodes // 100) == 0:
            learning_curve.append({"episode": state.episode, "reward": ep_reward, "steps": count})
            
    state.agent_pos = state.env.get_start_position()
    state.total_reward = 0.0
    state.steps = 0
    state.env.reset_to_initial() # Final restore for UI
    return {"status": "done", "curve": learning_curve, "env": state.env.to_dict()}

@app.post("/api/maze")
async def generate_maze():
    state.env.generate_maze()
    state.agent_pos = state.env.get_start_position()
    state.total_reward = 0.0
    state.steps = 0
    state.agent.q_table = {}
    state.agent.epsilon = state.agent.initial_epsilon
    state.env.initial_grid = [row[:] for row in state.env.grid]
    return {"status": "ok", "env": state.env.to_dict()}

@app.post("/api/clear")
async def clear_map():
    state.env.clear_grid()
    state.agent_pos = state.env.get_start_position()
    state.total_reward = 0.0
    state.steps = 0
    state.agent.q_table = {}
    state.agent.epsilon = state.agent.initial_epsilon
    state.env.initial_grid = [row[:] for row in state.env.grid]
    return {"status": "ok", "env": state.env.to_dict()}

@app.get("/api/path")
async def get_optimal_path():
    """Traces the best path from start using current Q-table (greedy)"""
    path = []
    curr_x, curr_y = state.env.get_start_position()
    path.append({"x": curr_x, "y": curr_y})
    
    visited = set([(curr_x, curr_y)])
    max_steps = state.env.width * state.env.height
    
    for _ in range(max_steps):
        state_key = (curr_x, curr_y)
        if state_key not in state.agent.q_table:
            break
            
        # Pick best action
        q_values = state.agent.q_table[state_key]
        best_action = max(q_values, key=q_values.get)
        
        # Simulate (without noise/stochasticity for "optimal" path)
        next_x, next_y, reward, is_terminal, hit_wall, cell_type = state.env.simulate_step(curr_x, curr_y, Action(best_action), step_penalty=0)
        
        if hit_wall: # Should not happen with good Q, but for safety
             break
             
        path.append({"x": next_x, "y": next_y})
        
        if is_terminal:
            break
            
        if (next_x, next_y) in visited: # Cycle detection
            break
            
        visited.add((next_x, next_y))
        curr_x, curr_y = next_x, next_y
        
    return {"path": path}

# WEBSOCKET LOOP
@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    state.connections.append(websocket)
    try:
        while True:
            # We can receive play/pause/speed commands here
            data = await websocket.receive_json()
            if data.get("action") == "play":
                state.is_running = True
                asyncio.create_task(simulation_loop())
            elif data.get("action") == "pause":
                state.is_running = False
            elif data.get("action") == "set_speed":
                state.speed_ms = data.get("speed", 100)
    except WebSocketDisconnect:
        state.connections.remove(websocket)

async def simulation_loop():
    while state.is_running:
        try:
            curr_x, curr_y = state.agent_pos
            curr_cell = state.env.get_cell(curr_x, curr_y)
            
            term = False
            delta = None
            ep_done = False
            last_reward = 0

            # If current pos is terminal, reset first
            if curr_cell in [CellType.TARGET, CellType.TRAP]:
                state.agent.decay_epsilon()
                state.episode += 1
                state.agent_pos = state.env.get_start_position()
                last_reward = state.total_reward
                state.total_reward = 0.0
                state.steps = 0
                ep_done = True
                state.env.reset_to_initial() # Respawn bonuses
            else:
                term, delta = await _perform_step()
                
            # Broadcast state
            q_delta_serializable = None
            if delta and delta['q_values']:
                q_delta_serializable = {
                    f"{delta['pos']['x']},{delta['pos']['y']}": {
                        a.value if hasattr(a, 'value') else str(a): v for a, v in delta['q_values'].items()
                    }
                }

            payload = {
                "type": "update",
                "agent_pos": {"x": state.agent_pos[0], "y": state.agent_pos[1]},
                "episode": state.episode,
                "steps": state.steps,
                "total_reward": state.total_reward,
                "epsilon": state.agent.epsilon,
                "q_delta": q_delta_serializable,
                "grid_update": delta.get("collected") if delta else None,
                "respawn_bonuses": ep_done # Optimization: Frontend uses local config to restore
            }
            if ep_done:
                payload["episode_done"] = True
                payload["episode_reward"] = last_reward
                
                
            # Throttled Broadcast: only send regular updates if enough time passed
            # But always send terminal updates (ep_done)
            now = time.time()
            if ep_done or (now - state.last_broadcast_time > 0.033): # ~30 FPS max
                for conn in state.connections:
                    await conn.send_json(payload)
                state.last_broadcast_time = now
                
            await asyncio.sleep(state.speed_ms / 1000.0)
        except Exception as e:
            error_msg = f"Simulation error: {str(e)}"
            print(error_msg)
            traceback.print_exc()
            # Broadcast error to frontend
            payload = {
                "type": "error",
                "message": error_msg
            }
            for conn in state.connections:
                try:
                    await conn.send_json(payload)
                except:
                    pass
            state.is_running = False
            break

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
