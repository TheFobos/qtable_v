import type { SetupConfig } from '../types';
import { Algorithm, RewardStrategy, Action } from '../types';
import { Play, Square, FastForward, Settings2, RefreshCcw, Command, HelpCircle } from 'lucide-react';

interface ControlPanelProps {
    config: SetupConfig;
    onConfigChange: (newConfig: SetupConfig) => void;
    onSetup: () => void;
    onPlay: () => void;
    onPause: () => void;
    onStep: () => void;
    onTurbo: () => void;
    onGenerateMaze: () => void;
    onClearMap: () => void;
    onSpeedChange: (speed: number) => void;
    isRunning: boolean;
    speed: number;
}

export function ControlPanel({
    config, onConfigChange, onSetup,
    onPlay, onPause, onStep, onTurbo, onGenerateMaze, onClearMap,
    onSpeedChange, isRunning, speed
}: ControlPanelProps) {

    const handleChange = (field: keyof SetupConfig, value: any) => {
        onConfigChange({ ...config, [field]: value });
    };

    const Tooltip = ({ text }: { text: string }) => (
        <span className="tooltip-trigger" title={text}>
            <HelpCircle size={14} style={{ opacity: 0.5, marginLeft: 4, cursor: 'help' }} />
        </span>
    );

    return (
        <div className="panel" style={{ height: '100%', overflowY: 'auto' }}>
            <h2><Settings2 size={20} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 8 }} /> Настройки</h2>

            <div className="card">
                <h3 style={{ fontSize: '0.9rem', marginBottom: '0.5rem', color: '#94a3b8' }}>Алгоритм</h3>
                <select
                    style={{ width: '100%', marginBottom: '1rem' }}
                    value={config.algorithm}
                    onChange={e => handleChange('algorithm', e.target.value as Algorithm)}
                >
                    <option value={Algorithm.Q_LEARNING}>Q-Learning (Off-policy)</option>
                    <option value={Algorithm.SARSA}>SARSA (On-policy)</option>
                </select>

                <h3 style={{ fontSize: '0.9rem', marginBottom: '0.5rem', color: '#94a3b8' }}>Цель обучения</h3>
                <select
                    style={{ width: '100%', marginBottom: '1rem' }}
                    value={config.strategy}
                    onChange={e => handleChange('strategy', e.target.value as RewardStrategy)}
                >
                    <option value={RewardStrategy.MINIMIZE_STEPS}>🏆 Кратчайший путь (игнорировать бонусы)</option>
                    <option value={RewardStrategy.COLLECT_ALL_REWARDS}>💰 Сбор всех наград (бонусов)</option>
                </select>

                <h3 style={{ fontSize: '0.9rem', marginBottom: '0.5rem', color: '#94a3b8' }}>Разрешенные действия</h3>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '1rem' }}>
                    {Object.values(Action).map(action => {
                        const isAllowed = !config.allowed_actions || config.allowed_actions.includes(action);
                        return (
                            <label key={action} style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px',
                                fontSize: '0.8rem',
                                cursor: 'pointer',
                                background: isAllowed ? 'rgba(56, 189, 248, 0.1)' : 'transparent',
                                padding: '4px 8px',
                                borderRadius: '4px',
                                border: `1px solid ${isAllowed ? '#38bdf8' : 'rgba(148, 163, 184, 0.2)'}`,
                                transition: 'all 0.2s'
                            }}>
                                <input
                                    type="checkbox"
                                    checked={isAllowed}
                                    onChange={e => {
                                        const current = config.allowed_actions || Object.values(Action);
                                        const next = e.target.checked
                                            ? [...current, action]
                                            : current.filter(a => a !== action);
                                        // Prevents disabling all actions (must have at least one)
                                        if (next.length > 0) {
                                            handleChange('allowed_actions', next);
                                        }
                                    }}
                                />
                                {action === Action.UP ? '⬆️ Вверх' :
                                    action === Action.DOWN ? '⬇️ Вниз' :
                                        action === Action.LEFT ? '⬅️ Влево' : '➡️ Вправо'}
                            </label>
                        );
                    })}
                </div>

                <h3 style={{ fontSize: '0.9rem', marginBottom: '0.5rem', color: '#94a3b8' }}>Гиперпараметры</h3>

                <div style={{ marginBottom: '1rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem' }}>
                        <span>Скорость обучения (α) <Tooltip text="Насколько сильно новые знания важнее старых. 0 - ничего не учим, 1 - помним только последнее." /></span>
                        <span>{config.alpha.toFixed(2)}</span>
                    </div>
                    <input type="range" min="0" max="1" step="0.01" value={config.alpha} onChange={e => handleChange('alpha', parseFloat(e.target.value))} />
                </div>

                <div style={{ marginBottom: '1rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem' }}>
                        <span>Дисконт (γ) <Tooltip text="Насколько важны будущие награды. 0 - только текущий момент, 1 - долгосрочная перспектива." /></span>
                        <span>{config.gamma.toFixed(2)}</span>
                    </div>
                    <input type="range" min="0" max="1" step="0.01" value={config.gamma} onChange={e => handleChange('gamma', parseFloat(e.target.value))} />
                </div>

                <div style={{ marginBottom: '1rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem' }}>
                        <span>Исследование (ε) <Tooltip text="Шанс случайного хода. Позволяет агенту находить новые пути вместо того, чтобы идти по знакомому." /></span>
                        <span>{config.epsilon.toFixed(2)}</span>
                    </div>
                    <input type="range" min="0" max="1" step="0.01" value={config.epsilon} onChange={e => handleChange('epsilon', parseFloat(e.target.value))} />
                </div>

                <div style={{ marginBottom: '1rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem' }}>
                        <span>Угасание ε <Tooltip text="Коэффициент, на который умножается шанс исследования после каждого эпизода." /></span>
                        <span>{config.epsilon_decay.toFixed(3)}</span>
                    </div>
                    <input type="range" min="0.9" max="1.0" step="0.001" value={config.epsilon_decay} onChange={e => handleChange('epsilon_decay', parseFloat(e.target.value))} />
                </div>

                <div style={{ marginBottom: '0.5rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem' }}>
                        <span>Штраф за шаг <Tooltip text="Отрицательная награда за каждое действие. Заставляет агента искать кратчайший путь." /></span>
                        <span>{config.step_penalty.toFixed(1)}</span>
                    </div>
                    <input type="range" min="-10" max="0" step="0.1" value={config.step_penalty} onChange={e => handleChange('step_penalty', parseFloat(e.target.value))} />
                </div>
            </div>

            <div className="card">
                <h3 style={{ fontSize: '0.9rem', marginBottom: '0.5rem', color: '#94a3b8' }}>Среда</h3>
                <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
                    <label style={{ flex: 1, display: 'flex', flexDirection: 'column', fontSize: '0.8rem' }}>
                        Ширина:
                        <input type="number" min="3" max="500" value={config.width} onChange={e => handleChange('width', parseInt(e.target.value) || 8)} />
                    </label>
                    <label style={{ flex: 1, display: 'flex', flexDirection: 'column', fontSize: '0.8rem' }}>
                        Высота:
                        <input type="number" min="3" max="500" value={config.height} onChange={e => handleChange('height', parseInt(e.target.value) || 8)} />
                    </label>
                </div>
                <button className="ghost" style={{ width: '100%', marginBottom: '1rem', fontSize: '0.8rem', padding: '0.4rem' }} onClick={onSetup}>
                    <RefreshCcw size={14} style={{ marginRight: 4 }} /> Изменить размер
                </button>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    <button className="primary" style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }} onClick={onSetup}>
                        <RefreshCcw size={16} /> Сброс агента
                    </button>
                    <button className="accent" style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }} onClick={onGenerateMaze}>
                        <Command size={16} /> Создать лабиринт
                    </button>
                    <button className="ghost" style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }} onClick={onClearMap}>
                        <RefreshCcw size={16} /> Очистить карту
                    </button>
                </div>
            </div>

            <div className="card" style={{ marginTop: 'auto' }}>
                <h3 style={{ fontSize: '0.9rem', marginBottom: '0.5rem', color: '#94a3b8' }}>Симуляция</h3>

                <div style={{ marginBottom: '1rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem' }}>
                        <span>Задержка (скорость)</span>
                        <span>{speed}мс</span>
                    </div>
                    <input type="range" min="0" max="500" step="10" value={500 - speed} onChange={e => onSpeedChange(500 - parseInt(e.target.value))} />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginBottom: '0.5rem' }}>
                    {isRunning ? (
                        <button className="warning" onClick={onPause} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
                            <Square size={16} /> Пауза
                        </button>
                    ) : (
                        <button className="success" onClick={onPlay} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
                            <Play size={16} /> Запуск
                        </button>
                    )}
                    <button onClick={onStep} disabled={isRunning} style={{ opacity: isRunning ? 0.5 : 1 }}>Шаг</button>
                </div>

                <button className="accent" onClick={onTurbo} disabled={isRunning} style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px', opacity: isRunning ? 0.5 : 1 }}>
                    <FastForward size={16} /> Турбо (1000 эп)
                </button>
            </div>

        </div>
    );
}
