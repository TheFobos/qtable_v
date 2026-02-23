import sys
import os

# Add backend directory to sys.path
sys.path.append(os.path.abspath(r"g:\1WORK\lab\qtable\v2\backend"))

from core.environment import Environment, CellType, Action, RewardStrategy
from core.agent import QLearningAgent

def test_action_constraints_and_stuck():
    # 2x2 grid
    # S W
    # E E
    cells = [
        ['start', 'wall'],
        ['empty', 'empty']
    ]
    
    print("Testing Action Constraints...")
    # Only RIGHT and DOWN allowed
    allowed = [Action.RIGHT, Action.DOWN]
    agent = QLearningAgent(allowed_actions=allowed)
    env = Environment(2, 2, cells=cells)
    
    # At (0,0), RIGHT is wall, DOWN is empty.
    # Agent should pick from RIGHT/DOWN.
    for _ in range(10):
        action, _, _ = agent.choose_action(0, 0)
        assert action in [Action.RIGHT, Action.DOWN], f"Agent picked forbidden action {action}"
    print("  Agent correctly picks only from allowed actions.")

    print("\nTesting Stuck Detection with disabled RIGHT...")
    # Scenrio: RIGHT is disabled, agent is stuck at (0,0) because only DOWN is allowed but DOWN is blocked?
    # Let's box the agent.
    # S W
    # W E
    cells_boxed = [
        ['start', 'wall'],
        ['wall', 'empty']
    ]
    env_boxed = Environment(2, 2, cells=cells_boxed)
    
    # Case 1: RIGHT disabled, only DOWN allowed but DOWN is wall.
    allowed_down_only = [Action.DOWN]
    stuck = env_boxed.is_stuck(0, 0, allowed_down_only)
    print(f"  Is agent stuck at (0,0) with only DOWN (wall) allowed? {stuck}")
    assert stuck == True

    # Simulation loop check (conceptually from main.py)
    # If agent is stuck and RIGHT is disabled, it should NOT KeyError.
    # fallback_action = state.allowed_actions[0] if state.allowed_actions else Action.RIGHT
    fallback = allowed_down_only[0] # DOWN
    print(f"  Using fallback action: {fallback}")
    
    # This call should NOT raise KeyError
    agent_restricted = QLearningAgent(allowed_actions=allowed_down_only)
    agent_restricted.update_q_value(0, 0, fallback, -100.0, 0, 0, True)
    print("  Terminal update with restricted actions successful (No KeyError).")

    print("\nSUCCESS: Action constraints and stuck detection verified!")

if __name__ == "__main__":
    test_action_constraints_and_stuck()
