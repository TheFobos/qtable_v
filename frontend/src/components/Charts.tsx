import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import type { LearningCurvePoint } from '../types';

interface ChartsProps {
    data: LearningCurvePoint[];
    theme?: 'dark' | 'light';
}

export function Charts({ data, theme = 'dark' }: ChartsProps) {
    if (data.length === 0) {
        return (
            <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)' }}>
                Пока нет данных
            </div>
        );
    }

    return (
        <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ flex: 1, minHeight: 0 }}>
                <h4 style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.5rem', textAlign: 'center' }}>Суммарная награда за эпизод</h4>
                <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={data}>
                        <CartesianGrid strokeDasharray="3 3" stroke={theme === 'dark' ? '#334155' : '#e2e8f0'} />
                        <XAxis dataKey="episode" stroke={theme === 'dark' ? '#94a3b8' : '#64748b'} fontSize={10} name="Эпизод" />
                        <YAxis stroke={theme === 'dark' ? '#94a3b8' : '#64748b'} fontSize={10} name="Награда" />
                        <Tooltip contentStyle={{ backgroundColor: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', color: 'var(--text-primary)' }} labelFormatter={(val) => `Эпизод: ${val}`} />
                        <Line type="monotone" dataKey="reward" stroke="#3b82f6" dot={false} strokeWidth={2} isAnimationActive={false} />
                    </LineChart>
                </ResponsiveContainer>
            </div>
            <div style={{ flex: 1, minHeight: 0 }}>
                <h4 style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.5rem', textAlign: 'center' }}>Шагов за эпизод</h4>
                <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={data}>
                        <CartesianGrid strokeDasharray="3 3" stroke={theme === 'dark' ? '#334155' : '#e2e8f0'} />
                        <XAxis dataKey="episode" stroke={theme === 'dark' ? '#94a3b8' : '#64748b'} fontSize={10} name="Эпизод" />
                        <YAxis stroke={theme === 'dark' ? '#94a3b8' : '#64748b'} fontSize={10} name="Шаги" />
                        <Tooltip contentStyle={{ backgroundColor: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', color: 'var(--text-primary)' }} labelFormatter={(val) => `Эпизод: ${val}`} />
                        <Line type="monotone" dataKey="steps" stroke="#f59e0b" dot={false} strokeWidth={2} isAnimationActive={false} />
                    </LineChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
}
