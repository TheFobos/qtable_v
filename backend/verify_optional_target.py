import sys
import os

# Add backend directory to sys.path
sys.path.append(os.path.abspath(r"g:\1WORK\lab\qtable\v2\backend"))

from core.environment import Environment, CellType, Action, RewardStrategy

def test_optional_target():
    # 2x2 grid with NO TARGET
    cells = [
        ['start', 'bonus:10'],
        ['empty', 'bonus:20']
    ]
    
    print("Testing Optional Target (Collect All Rewards)...")
    env = Environment(2, 2, cells=cells, strategy=RewardStrategy.COLLECT_ALL_REWARDS)
    
    print(f"  Has Target: {env.has_target}")
    assert env.has_target == False
    
    # 1. Collect first bonus at (1,0)
    _, _, reward1, is_term1, _, _ = env.simulate_step(0, 0, Action.RIGHT)
    print(f"  Collected first bonus. Reward: {reward1}, Terminal: {is_term1}")
    assert not is_term1
    
    # 2. Move down to (1,1)
    _, _, reward2, is_term2, _, _ = env.simulate_step(1, 0, Action.DOWN)
    print(f"  Collected last bonus. Reward: {reward2}, Terminal: {is_term2}")
    
    assert is_term2 == True
    # Reward should be base_bonus * 2.5 (from COLLECT_ALL_REWARDS) + 100.0 (completion)
    # base_bonus for (1,1) is 20.0
    # Expected = 20.0 * 2.5 + 100.0 = 50.0 + 100.0 = 150.0
    assert reward2 == 150.0, f"Expected 150.0, got {reward2}"

    print("\nSUCCESS: Optional Target logic verified!")

if __name__ == "__main__":
    test_optional_target()
