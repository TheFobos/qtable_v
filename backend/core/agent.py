import random
from enum import Enum
from typing import Dict, Tuple, Optional
from .environment import Action

class Algorithm(str, Enum):
    Q_LEARNING = "Q-Learning"
    SARSA = "SARSA"

class QLearningAgent:
    def __init__(self, 
                 alpha: float = 0.1, 
                 gamma: float = 0.9, 
                 epsilon: float = 0.2, 
                 epsilon_decay: float = 0.995,
                 min_epsilon: float = 0.01,
                 algorithm: Algorithm = Algorithm.Q_LEARNING,
                 allowed_actions: Optional[list] = None):
        self.alpha = alpha
        self.gamma = gamma
        self.epsilon = epsilon
        self.initial_epsilon = epsilon
        self.epsilon_decay = epsilon_decay
        self.min_epsilon = min_epsilon
        self.algorithm = algorithm
        self.q_table: Dict[Tuple[int, int], Dict[Action, float]] = {}
        self.actions = allowed_actions if allowed_actions else Action.all_actions()
        
    def _get_state_key(self, x: int, y: int) -> Tuple[int, int]:
        return (x, y)
        
    def _init_state_if_needed(self, state_key: Tuple[int, int]):
        if state_key not in self.q_table:
            self.q_table[state_key] = {a: 0.0 for a in self.actions}
            
    def choose_action(self, x: int, y: int) -> Tuple[Action, bool, float]:
        state_key = self._get_state_key(x, y)
        self._init_state_if_needed(state_key)
        
        is_random = False
        # Only allowed actions are considered
        available_actions = [a for a in self.actions]
        
        if not available_actions:
             # Fallback if no actions allowed (should be prevented by UI but for extreme safety)
             fallback = Action.all_actions()[0]
             return fallback, False, 0.0

        if random.random() < self.epsilon:
            action = random.choice(available_actions)
            is_random = True
        else:
            q_values = {a: self.q_table[state_key][a] for a in available_actions}
            max_q = max(q_values.values())
            # Handle ties randomly
            best_actions = [a for a, q in q_values.items() if q == max_q]
            action = random.choice(best_actions)
            
        return action, is_random, self.q_table[state_key][action]
        
    def update_q_value(self, x: int, y: int, action: Action, reward: float, 
                      next_x: int, next_y: int, is_terminal: bool, next_action: Optional[Action] = None):
        """
        Updates Q-value based on chosen algorithm.
        SARSA requires next_action to be provided.
        """
        state_key = self._get_state_key(x, y)
        next_state_key = self._get_state_key(next_x, next_y)
        
        self._init_state_if_needed(state_key)
        
        if action not in self.q_table[state_key]:
            # This can happen if allowed_actions changed mid-simulation
            # or if a fallback action was used that isn't in current allowed set.
            # We skip the update to prevent KeyError.
            return

        old_q = self.q_table[state_key][action]
        
        if is_terminal:
            target_q = 0.0
        else:
            self._init_state_if_needed(next_state_key)
            if self.algorithm == Algorithm.Q_LEARNING:
                # Q-Learning: Off-policy (max next Q)
                target_q = max(self.q_table[next_state_key].values())
            elif self.algorithm == Algorithm.SARSA:
                # SARSA: On-policy (actual next action's Q)
                if next_action is None:
                    # Fallback if next action not provided for some reason
                    target_q = max(self.q_table[next_state_key].values())
                else:
                    target_q = self.q_table[next_state_key][next_action]
            
        new_q = old_q + self.alpha * (reward + self.gamma * target_q - old_q)
        self.q_table[state_key][action] = new_q
        
    def decay_epsilon(self):
        """Reduces epsilon after an episode if decay is enabled"""
        if self.epsilon > self.min_epsilon:
            self.epsilon = max(self.min_epsilon, self.epsilon * self.epsilon_decay)
            
    def reset(self):
        """Full reset of agent's knowledge and epsilon"""
        self.q_table.clear()
        self.epsilon = self.initial_epsilon
