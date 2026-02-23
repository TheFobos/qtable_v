import sys
import os

# Add backend directory to sys.path
sys.path.append(os.path.abspath(r"g:\1WORK\lab\qtable\v2\backend"))

from core.environment import Environment, CellType, Action, RewardStrategy

def test_reward_editor():
    # 3x3 grid with different bonus values
    cells = [
        ['start', 'empty', 'empty'],
        ['bonus:2', 'empty', 'bonus:5'],
        ['empty', 'empty', 'target']
    ]
    
    print("Testing Reward Editor (Step Minimization)...")
    env = Environment(3, 3, cells=cells, strategy=RewardStrategy.MINIMIZE_STEPS)
    
    # Collect bonus at (0,1) with value 2
    _, _, reward2, _, _, _ = env.simulate_step(0, 0, Action.DOWN, step_penalty=-1.0)
    print(f"  Collected bonus:2. Reward: {reward2}")
    
    # Move to (1,1)
    _, _, _, _, _, _ = env.simulate_step(0, 1, Action.RIGHT)
    
    # Collect bonus at (2,1) with value 5
    _, _, reward5, _, _, _ = env.simulate_step(1, 1, Action.RIGHT, step_penalty=-1.0)
    print(f"  Collected bonus:5. Reward: {reward5}")

    assert reward2 == 2.0, f"Expected 2.0, got {reward2}"
    assert reward5 == 5.0, f"Expected 5.0, got {reward5}"
    
    # Reset and test COLLECT_ALL_REWARDS
    print("\nTesting Reward Editor (Collect All Reards)...")
    env_coll = Environment(3, 3, cells=cells, strategy=RewardStrategy.COLLECT_ALL_REWARDS)
    
    # Collect bonus at (0,1) with value 2. 
    # Logic: max(50.0, base_bonus * 2.5) => max(50.0, 2 * 2.5) = 50.0
    _, _, reward_coll2, _, _, _ = env_coll.simulate_step(0, 0, Action.DOWN, step_penalty=-1.0)
    print(f"  Collected bonus:2 (scaled). Reward: {reward_coll2}")
    
    assert reward_coll2 == 50.0, f"Expected 50.0, got {reward_coll2}"

    print("\nSUCCESS: Reward Editor verified!")

if __name__ == "__main__":
    test_reward_editor()
