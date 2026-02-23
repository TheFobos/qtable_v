export type CellType = 'empty' | 'wall' | 'start' | 'target' | 'trap' | 'bonus';

export enum Action {
    UP = 'UP',
    DOWN = 'DOWN',
    LEFT = 'LEFT',
    RIGHT = 'RIGHT'
}

export enum Algorithm {
    Q_LEARNING = 'Q-Learning',
    SARSA = 'SARSA'
}

export enum RewardStrategy {
    COLLECT_ALL_REWARDS = 'collect_all',
    MINIMIZE_STEPS = 'minimize_steps'
}

export interface GridState {
    width: number;
    height: number;
    cells: string[][];
}

export type QTable = Record<string, Record<Action, number>>;

export interface AgentPos {
    x: number;
    y: number;
}

export interface SimulationState {
    env: GridState;
    agent_pos: AgentPos;
    q_table: QTable;
    episode: number;
    steps: number;
    total_reward: number;
    epsilon: number;
    update_version?: number;
}

export interface SetupConfig {
    width: number;
    height: number;
    cells?: string[][];
    alpha: number;
    gamma: number;
    epsilon: number;
    epsilon_decay: number;
    min_epsilon: number;
    algorithm: Algorithm;
    step_penalty: number;
    strategy: RewardStrategy;
    allowed_actions?: Action[];
}

export interface LearningCurvePoint {
    episode: number;
    reward: number;
    steps: number;
}
