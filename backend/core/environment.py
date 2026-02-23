from enum import Enum
from typing import List, Tuple, Dict, Any, Optional
import random

class CellType(str, Enum):
    EMPTY = 'empty'
    WALL = 'wall'
    START = 'start'
    TARGET = 'target'
    TRAP = 'trap'
    BONUS = 'bonus'

class RewardStrategy(str, Enum):
    COLLECT_ALL_REWARDS = 'collect_all'
    MINIMIZE_STEPS = 'minimize_steps'

class Action(str, Enum):
    UP = 'UP'
    DOWN = 'DOWN'
    LEFT = 'LEFT'
    RIGHT = 'RIGHT'
    
    @classmethod
    def all_actions(cls) -> List['Action']:
        return [cls.UP, cls.DOWN, cls.LEFT, cls.RIGHT]

class Environment:
    def __init__(self, width: int, height: int, cells: List[List[str]] = None, strategy: RewardStrategy = RewardStrategy.MINIMIZE_STEPS):
        self.width = width
        self.height = height
        self.strategy = strategy
        self.bonus_values: Dict[Tuple[int, int], float] = {}
        
        if cells is None:
            self.grid = [[CellType.EMPTY for _ in range(width)] for _ in range(height)]
            if width > 0 and height > 0:
                self.grid[0][0] = CellType.START
                self.grid[height-1][width-1] = CellType.TARGET
        else:
            self.grid = [[CellType.EMPTY for _ in range(width)] for _ in range(height)]
            for y in range(height):
                for x in range(width):
                    cell_str = str(cells[y][x])
                    if cell_str.startswith('bonus'):
                        self.grid[y][x] = CellType.BONUS
                        try:
                            if ':' in cell_str:
                                self.bonus_values[(x, y)] = float(cell_str.split(':')[1])
                            else:
                                self.bonus_values[(x, y)] = 20.0 # Default
                        except ValueError:
                            self.bonus_values[(x, y)] = 20.0
                    else:
                        try:
                            self.grid[y][x] = CellType(cell_str)
                        except ValueError:
                            self.grid[y][x] = CellType.EMPTY
        
        self.initial_grid = [row[:] for row in self.grid]
        self.initial_bonus_values = self.bonus_values.copy()
        self._recalculate_metadata()

    def _recalculate_metadata(self):
        """Updates internal flags based on current grid state"""
        self.has_target = any(CellType.TARGET in row for row in self.grid)
            
    def generate_maze(self):
        """Generates a maze using Randomized DFS and ensures Start and Target are connected."""
        # 1. Fill with walls
        for y in range(self.height):
            for x in range(self.width):
                self.grid[y][x] = CellType.WALL
                
        # 2. Start carving from (1, 1). Ensure dimensions allow carving.
        start_x, start_y = 1, 1
        if self.width <= 3 or self.height <= 3:
            # Special case for very small grids: just clear them
            self.clear_grid()
            return

        self.grid[start_y][start_x] = CellType.EMPTY
        stack = [(start_x, start_y)]
        visited = set([(start_x, start_y)])
        
        while stack:
            cx, cy = stack[-1]
            neighbors = []
            for dx, dy in [(0, 2), (0, -2), (2, 0), (-2, 0)]:
                nx, ny = cx + dx, cy + dy
                if 0 < nx < self.width - 1 and 0 < ny < self.height - 1 and (nx, ny) not in visited:
                    neighbors.append((nx, ny))
            
            if neighbors:
                nx, ny = random.choice(neighbors)
                # Remove wall between
                self.grid[cy + (ny - cy) // 2][cx + (nx - cx) // 2] = CellType.EMPTY
                self.grid[ny][nx] = CellType.EMPTY
                visited.add((nx, ny))
                stack.append((nx, ny))
            else:
                stack.pop()
                
        # 3. Ensure Start (0,0) and Target (H-1, W-1) are connected to the carved area
        # Connect Start (0,0) -> (1,1)
        self.grid[0][0] = CellType.START
        self.grid[0][1] = CellType.EMPTY
        self.grid[1][1] = CellType.EMPTY
        
        # Connect Target (H-1, W-1) -> nearest carved empty cell
        self.grid[self.height-1][self.width-1] = CellType.TARGET
        
        # Connect target to the maze body (try bottom-left or top-right neighbors)
        if self.height > 2:
            self.grid[self.height-2][self.width-1] = CellType.EMPTY
            self.grid[self.height-3][self.width-1] = CellType.EMPTY
        if self.width > 2:
            self.grid[self.height-1][self.width-2] = CellType.EMPTY
            self.grid[self.height-1][self.width-3] = CellType.EMPTY

        # Optional: Add some random loops to make it less "perfect" tree and more interesting
        for _ in range((self.width * self.height) // 10):
            rx = random.randint(1, self.width - 2)
            ry = random.randint(1, self.height - 2)
            if self.grid[ry][rx] == CellType.WALL:
                # Check neighbors: if has 2 empty neighbors, maybe clear it
                empty_count = 0
                for dx, dy in [(0, 1), (0, -1), (1, 0), (-1, 0)]:
                    if self.grid[ry+dy][rx+dx] == CellType.EMPTY:
                        empty_count += 1
                if empty_count >= 2:
                    self.grid[ry][rx] = CellType.EMPTY

        self.grid[self.height-1][self.width-1] = CellType.TARGET
        self.initial_grid = [row[:] for row in self.grid]
        self._recalculate_metadata()

    def clear_grid(self):
        """Resets the grid to an empty state with only Start and Target"""
        for y in range(self.height):
            for x in range(self.width):
                self.grid[y][x] = CellType.EMPTY
        
        if self.width > 0 and self.height > 0:
            self.grid[0][0] = CellType.START
            self.grid[self.height-1][self.width-1] = CellType.TARGET
            
        self.initial_grid = [row[:] for row in self.grid]
        self._recalculate_metadata()

    def reset_to_initial(self):
        """Restores the grid from initial_grid (respawns bonuses)"""
        self.grid = [row[:] for row in self.initial_grid]
        self.bonus_values = self.initial_bonus_values.copy()
        self._recalculate_metadata()
            
    def get_cell(self, x: int, y: int) -> CellType:
        if 0 <= x < self.width and 0 <= y < self.height:
            return self.grid[y][x]
        return CellType.WALL
        
    def set_cell(self, x: int, y: int, cell_type: CellType):
        if 0 <= x < self.width and 0 <= y < self.height:
            self.grid[y][x] = cell_type
            self.initial_grid[y][x] = cell_type # Update both for persistent changes
            self._recalculate_metadata()

    def get_start_position(self) -> Tuple[int, int]:
        for y in range(self.height):
            for x in range(self.width):
                if self.grid[y][x] == CellType.START:
                    return (x, y)
        return (0, 0)
        
    def can_move(self, x: int, y: int, action: Action) -> bool:
        """Checks if the agent can move in the given direction from (x, y)"""
        nx, ny = x, y
        if action == Action.UP: ny -= 1
        elif action == Action.DOWN: ny += 1
        elif action == Action.LEFT: nx -= 1
        elif action == Action.RIGHT: nx += 1
        
        # Bounds check
        if not (0 <= nx < self.width and 0 <= ny < self.height):
            return False
            
        # Wall check
        if self.grid[ny][nx] == CellType.WALL:
            return False
            
        return True

    def is_stuck(self, x: int, y: int, allowed_actions: List[Action]) -> bool:
        """Returns True if the agent has no viable moves among the allowed actions"""
        # If no actions allowed at all, agent is stuck
        if not allowed_actions:
            return True
            
        # Check if any allowed action is viable
        for action in allowed_actions:
            if self.can_move(x, y, action):
                return False
                
        return True
        
    def to_dict(self) -> Dict[str, Any]:
        cells_dict = []
        for y in range(self.height):
            row = []
            for x in range(self.width):
                cell = self.grid[y][x]
                if cell == CellType.BONUS:
                    val = self.bonus_values.get((x, y), 20.0)
                    row.append(f"bonus:{val}")
                else:
                    row.append(cell.value)
            cells_dict.append(row)
            
        return {
            "width": self.width,
            "height": self.height,
            "cells": cells_dict
        }

    def simulate_step(self, x: int, y: int, action: Action, step_penalty: float = -1.0) -> Tuple[int, int, float, bool, bool, CellType]:
        """
        Calculates the outcome of an action from a given state.
        Returns: (next_x, next_y, reward, is_terminal, hit_wall, cell_type)
        """
        # Adjust step penalty based on strategy if using default
        actual_step_penalty = step_penalty
        if self.strategy == RewardStrategy.COLLECT_ALL_REWARDS:
            # Encourage thorough exploration by reducing step penalty
            actual_step_penalty = -0.1
        
        next_x, next_y = x, y
        
        if action == Action.UP:
            next_y -= 1
        elif action == Action.DOWN:
            next_y += 1
        elif action == Action.LEFT:
            next_x -= 1
        elif action == Action.RIGHT:
            next_x += 1
            
        # Bounds check
        if not (0 <= next_x < self.width and 0 <= next_y < self.height):
            return (x, y, actual_step_penalty, False, True, CellType.WALL) # Penalty for hitting boundaries
            
        cell = self.grid[next_y][next_x]
        
        if cell == CellType.WALL:
            return (x, y, actual_step_penalty, False, True, CellType.WALL) # Penalty for hitting walls
            
        # Determine reward
        reward = actual_step_penalty
        is_terminal = False
        
        if cell == CellType.TARGET:
            reward = 100.0
            is_terminal = True
        elif cell == CellType.TRAP:
            reward = -100.0
            is_terminal = True
        elif cell == CellType.BONUS:
            base_bonus = self.bonus_values.get((next_x, next_y), 20.0)
            if self.strategy == RewardStrategy.COLLECT_ALL_REWARDS:
                # Ensure bonus is significantly higher than step penalty to motivate agent
                reward = max(50.0, base_bonus * 2.5) 
            else:
                reward = base_bonus
                
            self.grid[next_y][next_x] = CellType.EMPTY # Collected!
            if (next_x, next_y) in self.bonus_values:
                del self.bonus_values[(next_x, next_y)]
            
            # If no target exists, collecting all bonuses ends the episode
            if self.strategy == RewardStrategy.COLLECT_ALL_REWARDS and not self.has_target:
                bonuses_remaining = any(CellType.BONUS in row for row in self.grid)
                if not bonuses_remaining:
                    is_terminal = True
                    reward += 100.0 # Bonus for completing the task
            
        return (next_x, next_y, reward, is_terminal, False, cell)
