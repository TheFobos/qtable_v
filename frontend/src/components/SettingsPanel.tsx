import { Moon, Sun, Settings2 } from 'lucide-react';

interface SettingsPanelProps {
    theme: 'dark' | 'light';
    onThemeChange: (theme: 'dark' | 'light') => void;
}

export function SettingsPanel({ theme, onThemeChange }: SettingsPanelProps) {
    return (
        <div className="panel" style={{ height: '100%', overflowY: 'auto' }}>
            <h2><Settings2 size={20} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 8 }} /> Настройки</h2>

            <div className="card">
                <h3 style={{ fontSize: '0.9rem', marginBottom: '1rem', color: 'var(--text-secondary)' }}>Внешний вид</h3>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    <div style={{ fontSize: '0.85rem', marginBottom: '0.5rem' }}>Тема оформления:</div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                        <button
                            className={theme === 'dark' ? 'primary' : ''}
                            onClick={() => onThemeChange('dark')}
                            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', fontSize: '0.9rem' }}
                        >
                            <Moon size={16} /> Темная
                        </button>
                        <button
                            className={theme === 'light' ? 'primary' : ''}
                            onClick={() => onThemeChange('light')}
                            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', fontSize: '0.9rem' }}
                        >
                            <Sun size={16} /> Светлая
                        </button>
                    </div>
                </div>
            </div>

            <div className="card">
                <h3 style={{ fontSize: '0.9rem', marginBottom: '0.5rem', color: 'var(--text-secondary)' }}>Горячие клавиши</h3>
                <div style={{ fontSize: '0.8rem', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span>Скрыть интерфейс</span>
                        <kbd>F1</kbd>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span>На весь экран</span>
                        <kbd>F11</kbd>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span>Запуск / Пауза</span>
                        <kbd>Пробел</kbd>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span>Один шаг</span>
                        <kbd>→</kbd>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span>Ускорение (буст)</span>
                        <kbd>Shift (удерж.)</kbd>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span>Турбо (1000 эп.)</span>
                        <kbd>Ctrl+Shift+Enter</kbd>
                    </div>
                </div>
            </div>
        </div>
    );
}
