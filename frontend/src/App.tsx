import { useState, useEffect, useRef, useCallback } from 'react';
import { CanvasGrid } from './components/CanvasGrid';
import { ControlPanel } from './components/ControlPanel';
import { SettingsPanel } from './components/SettingsPanel';
import { Charts } from './components/Charts';
import { APIClient, WSClient } from './api';
import { Algorithm, RewardStrategy, type SetupConfig, type SimulationState, type LearningCurvePoint, type CellType } from './types';
import { Activity, Layers, Route, Play, Settings2, Maximize2, Minimize2, Eye, EyeOff } from 'lucide-react';

const DEFAULT_CONFIG: SetupConfig = {
  width: 15,
  height: 15,
  alpha: 0.1,
  gamma: 0.9,
  epsilon: 0.2,
  epsilon_decay: 0.995,
  min_epsilon: 0.01,
  algorithm: Algorithm.Q_LEARNING,
  step_penalty: -1.0,
  strategy: RewardStrategy.MINIMIZE_STEPS
};

function App() {
  const [config, setConfig] = useState<SetupConfig>(DEFAULT_CONFIG);
  const [state, setState] = useState<SimulationState | null>(null);
  const [curve, setCurve] = useState<LearningCurvePoint[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [speed, setSpeed] = useState(100);
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [activeTab, setActiveTab] = useState<'control' | 'settings'>('control');

  // View Settings
  const [showHeatmap, setShowHeatmap] = useState(true);
  const [uiHidden, setUiHidden] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showArrows, setShowArrows] = useState(true);
  const [showNumbers, setShowNumbers] = useState(false);
  const [showPath, setShowPath] = useState(true);
  const [hideCellContents, setHideCellContents] = useState(false);
  const [smoothHeatmap, setSmoothHeatmap] = useState(false);
  const [showMinima, setShowMinima] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [drawMode, setDrawMode] = useState<CellType>('wall');
  const [bonusValue, setBonusValue] = useState(20);
  const [optimalPath, setOptimalPath] = useState<{ x: number, y: number }[]>([]);
  const optimalPathRef = useRef<{ x: number, y: number }[]>([]); // Optional: keep as ref for non-reactive needs if any
  const qTableRef = useRef<Record<string, any>>({});
  const lastSpeed = useRef(speed);
  const wsClient = useRef(new WSClient());

  const loadState = useCallback(async () => {
    try {
      const st = await APIClient.getState();
      setState(st);
      fetchPath();
    } catch (e) {
      console.error("Failed to load state", e);
    }
  }, []); // Recursion with fetchPath but it's okay if fetchPath is stable

  const fetchPath = useCallback(async () => {
    try {
      const res = await APIClient.getPath();
      setOptimalPath(res.path);
      optimalPathRef.current = res.path;
    } catch (e) {
      console.error("Failed to fetch path", e);
    }
  }, []);

  const handleSetup = useCallback(async () => {
    setIsRunning(false);
    wsClient.current.pause();
    setError(null);
    await APIClient.setup(config);
    setCurve([]);
    await loadState();
  }, [config, loadState]);

  const handleGenerateMaze = useCallback(async () => {
    setIsRunning(false);
    wsClient.current.pause();
    const res = await APIClient.generateMaze();
    if (res.status === 'ok') {
      setConfig(prev => ({ ...prev, cells: res.env.cells, width: res.env.width, height: res.env.height }));
      setCurve([]);
      await loadState();
    }
  }, [loadState]);

  const handleClearMap = useCallback(async () => {
    setIsRunning(false);
    wsClient.current.pause();
    const res = await APIClient.clearMap();
    if (res.status === 'ok') {
      setConfig(prev => ({ ...prev, cells: res.env.cells, width: res.env.width, height: res.env.height }));
      setCurve([]);
      await loadState();
    }
  }, [loadState]);

  const handlePlay = useCallback(() => {
    setIsRunning(true);
    wsClient.current.play();
  }, []);

  const handlePause = useCallback(() => {
    setIsRunning(false);
    wsClient.current.pause();
    fetchPath();
  }, []);

  const handleSpeedChange = useCallback((newSpeed: number) => {
    setSpeed(newSpeed);
    wsClient.current.setSpeed(newSpeed);
  }, []);

  const handleStep = useCallback(async () => {
    const res = await APIClient.step();
    if (res.status === 'terminal' || res.status === 'reset') {
      setCurve(prev => {
        if (res.status === 'reset' && res.episode_reward !== undefined) {
          // We can update the curve here if we want, but loadState is safer
        }
        return prev;
      });
      fetchPath();
    }
    await loadState();
  }, []); // No state dependency

  const handleTurbo = useCallback(async (count: number = 1000) => {
    setIsRunning(false);
    wsClient.current.pause();
    // Ensure backend has current config before turbo
    await APIClient.updateConfig(config);
    const res = await APIClient.turbo(count);
    if (res.status === 'done') {
      setCurve(prev => [...prev.slice(-100), ...res.curve]);
      await loadState();
    }
  }, [config]);

  // Sync config to backend whenever it changes (debounced)
  useEffect(() => {
    const timer = setTimeout(async () => {
      try {
        await APIClient.updateConfig(config);
      } catch (err) {
        console.error("Auto-sync config failed", err);
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [
    config.alpha, config.gamma, config.epsilon, config.epsilon_decay,
    config.min_epsilon, config.algorithm, config.step_penalty,
    config.strategy, config.allowed_actions
  ]);

  // Handle WebSocket messages with refs to avoid useEffect reconnection loops
  const onMessageRef = useRef<(data: any) => void>(undefined);
  onMessageRef.current = (data: any) => {
    if (data.type === 'update') {
      if (data.q_delta) {
        Object.assign(qTableRef.current, data.q_delta);
      } else if (data.q_table) {
        qTableRef.current = data.q_table;
      }

      setState(prev => prev ? {
        ...prev,
        agent_pos: data.agent_pos,
        q_table: qTableRef.current,
        episode: data.episode,
        steps: data.steps,
        total_reward: data.total_reward,
        epsilon: data.epsilon,
        update_version: (prev as any).update_version ? (prev as any).update_version + 1 : 1
      } : null);

      if (data.grid_update) {
        const { x, y } = data.grid_update;
        setState(prev => {
          if (!prev) return null;
          const newCells = [...prev.env.cells];
          newCells[y] = [...newCells[y]];
          newCells[y][x] = 'empty' as any;
          return { ...prev, env: { ...prev.env, cells: newCells } };
        });
      }

      if (data.respawn_bonuses && config.cells) {
        setState(prev => {
          if (!prev) return null;
          return { ...prev, env: { ...prev.env, cells: config.cells! } };
        });
      }

      if (data.full_grid) {
        setState(prev => {
          if (!prev) return null;
          return { ...prev, env: { ...prev.env, cells: data.full_grid } };
        });
      }

      if (data.episode_done) {
        setCurve(prev => {
          const newPoint = {
            episode: data.episode,
            reward: data.episode_reward,
            steps: data.steps
          };
          const updated = [...prev, newPoint];
          return updated.slice(-200);
        });
        fetchPath();
      }
    } else if (data.type === 'error') {
      setError(data.message);
      setIsRunning(false);
    }
  };

  // Initial setup call - ONLY once on mount
  useEffect(() => {
    handleSetup();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Stable WebSocket connection
  useEffect(() => {
    wsClient.current.connect((data) => onMessageRef.current?.(data));
    return () => wsClient.current.disconnect();
  }, []); // Only connect once

  // Hotkeys - stable and using refs where needed
  const isRunningRef = useRef(isRunning);
  useEffect(() => { isRunningRef.current = isRunning; }, [isRunning]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isInput = ['INPUT', 'SELECT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName);
      if (isInput) return;

      if (e.key === 'F1') {
        e.preventDefault();
        setUiHidden(prev => {
          const newState = !prev;
          setTimeout(() => window.dispatchEvent(new Event('resize')), 100);
          return newState;
        });
      }
      if (e.key === 'F11') {
        e.preventDefault();
        toggleFullscreen();
      }
      if (e.key === ' ') {
        e.preventDefault();
        isRunningRef.current ? handlePause() : handlePlay();
      }
      if (e.key === 'ArrowRight') {
        e.preventDefault();
        if (!isRunningRef.current) handleStep();
      }
      if (e.key === 'Shift') {
        if (!e.repeat) {
          lastSpeed.current = speed;
          handleSpeedChange(0); // 0ms delay = max speed
        }
      }
      if (e.key === 'Enter' && e.ctrlKey && e.shiftKey) {
        e.preventDefault();
        handleTurbo(1000);
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'Shift') {
        // Only restore if we are not already at the speed we restated from
        handleSpeedChange(lastSpeed.current);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    document.addEventListener('fullscreenchange', () => {
      setIsFullscreen(!!document.fullscreenElement);
    });

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [handlePlay, handlePause, handleStep, handleTurbo, handleSpeedChange, speed]); // speed included for Shift boost restore

  const toggleFullscreen = () => {
    // Try native pywebview fullscreen first
    if ((window as any).pywebview && (window as any).pywebview.api && (window as any).pywebview.api.toggle_fullscreen) {
      (window as any).pywebview.api.toggle_fullscreen();
      setUiHidden(!isFullscreen); // Toggle Zen mode if we think we are entering fullscreen
      return;
    }

    // Fallback to browser fullscreen
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().then(() => {
        setUiHidden(true); // Auto-hide UI in fullscreen for "Zen" experience
      }).catch(err => {
        console.error(`Error attempting to enable full-screen mode: ${err.message}`);
      });
    } else {
      document.exitFullscreen();
    }
  };


  useEffect(() => {
    // Force canvas resize when UI visibility changes
    const timer = setTimeout(() => {
      window.dispatchEvent(new Event('resize'));
    }, 350); // Matches CSS transition duration
    return () => clearTimeout(timer);
  }, [uiHidden]);


  const handleSyncMap = async () => {
    if (!state) return;
    await APIClient.setup(config);
    await loadState();
  };

  const handleCellAction = useCallback(async (x: number, y: number, isDrag: boolean = false) => {
    if (!state || isRunning) return;

    const newCells = config.cells ? config.cells.map(row => [...row]) : state.env.cells.map(row => [...row]);

    const targetCellValue = drawMode === 'bonus' ? `bonus:${bonusValue}` : drawMode;
    if (newCells[y][x] === targetCellValue) return;

    if (drawMode === 'start' || drawMode === 'target') {
      for (let ry = 0; ry < (config.height || state.env.height); ry++) {
        for (let rx = 0; rx < (config.width || state.env.width); rx++) {
          if (newCells[ry][rx] === drawMode) newCells[ry][rx] = 'empty' as any;
        }
      }
    }

    newCells[y][x] = targetCellValue;

    const newConfig = { ...config, cells: newCells };
    setConfig(newConfig);

    // Only sync immediately on click, not on drag
    if (!isDrag) {
      try {
        await APIClient.setup(newConfig);
        await loadState();
      } catch (err) {
        console.error("Failed to sync cell change", err);
      }
    }
  }, [state, isRunning, drawMode, config, bonusValue]);

  if (!state) {
    return <div style={{ display: 'flex', height: '100vh', alignItems: 'center', justifyContent: 'center', background: '#0f172a', color: 'white' }}>Подключение к бэкенду...</div>;
  }

  return (
    <div className={`layout ${theme}-theme ${uiHidden ? 'ui-hidden' : ''}`}>
      {error && (
        <div className="error-banner" style={{
          position: 'fixed',
          top: '1rem',
          left: '50%',
          transform: 'translateX(-50%)',
          backgroundColor: '#ef4444',
          color: 'white',
          padding: '0.75rem 1.5rem',
          borderRadius: '8px',
          boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
          zIndex: 9999,
          display: 'flex',
          alignItems: 'center',
          gap: '1rem',
          animation: 'slideDown 0.3s ease-out'
        }}>
          <span>{error}</span>
          <button
            onClick={() => setError(null)}
            style={{
              background: 'rgba(0,0,0,0.2)',
              border: 'none',
              color: 'white',
              padding: '2px 8px',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            ✕
          </button>
        </div>
      )}
      <aside className="sidebar-left">
        <div className="tabs-header">
          <button
            className={`tab-btn ${activeTab === 'control' ? 'active' : ''}`}
            onClick={() => setActiveTab('control')}
          >
            <Play size={14} /> Симуляция
          </button>
          <button
            className={`tab-btn ${activeTab === 'settings' ? 'active' : ''}`}
            onClick={() => setActiveTab('settings')}
          >
            <Settings2 size={14} /> Настройки
          </button>
        </div>

        {activeTab === 'control' ? (
          <ControlPanel
            config={config}
            onConfigChange={setConfig}
            onSetup={handleSetup}
            onPlay={handlePlay}
            onPause={handlePause}
            onStep={handleStep}
            onTurbo={() => handleTurbo(1000)}
            onGenerateMaze={handleGenerateMaze}
            onClearMap={handleClearMap}
            onSpeedChange={handleSpeedChange}
            isRunning={isRunning}
            speed={speed}
          />
        ) : (
          <SettingsPanel
            theme={theme}
            onThemeChange={setTheme}
          />
        )}
      </aside>

      <main className="main-content">
        {!uiHidden && (
          <div className="panel" style={{ flex: '0 0 auto', display: 'flex', flexDirection: 'row', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <h2 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', margin: 0 }}><Layers size={20} /> Визуализация</h2>
            <label className="view-toggle">
              <input type="checkbox" checked={showHeatmap} onChange={e => setShowHeatmap(e.target.checked)} />
              Теплокарта
            </label>
            <label className="view-toggle">
              <input type="checkbox" checked={showArrows} onChange={e => setShowArrows(e.target.checked)} />
              Стрелки
            </label>
            <label className="view-toggle">
              <input type="checkbox" checked={showNumbers} onChange={e => setShowNumbers(e.target.checked)} />
              Q-значения
            </label>
            <label className="view-toggle" style={{ color: '#f472b6' }}>
              <input type="checkbox" checked={showPath} onChange={e => setShowPath(e.target.checked)} />
              <Route size={14} style={{ marginRight: 4 }} /> Путь
            </label>
            <label className="view-toggle">
              <input type="checkbox" checked={hideCellContents} onChange={e => setHideCellContents(e.target.checked)} />
              Скрыть клетки
            </label>
            <label className="view-toggle">
              <input type="checkbox" checked={smoothHeatmap} onChange={e => setSmoothHeatmap(e.target.checked)} />
              Плавный градиент
            </label>
            <label className="view-toggle" style={{ color: '#ef4444' }}>
              <input type="checkbox" checked={showMinima} onChange={e => setShowMinima(e.target.checked)} />
              Минимумы
            </label>

            <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
              <span style={{ fontSize: '0.8rem', color: '#94a3b8', marginRight: 5 }}>Кисть:</span>
              {(['empty', 'wall', 'start', 'target', 'trap', 'bonus'] as CellType[]).map(type => (
                <button
                  key={type}
                  className={`palette-btn ${drawMode === type ? 'active' : ''}`}
                  onClick={() => setDrawMode(type)}
                  title={type === 'empty' ? 'Пусто' : type === 'wall' ? 'Стена' : type === 'start' ? 'Старт' : type === 'target' ? 'Цель' : type === 'trap' ? 'Ловушка' : 'Бонус'}
                >
                  {type === 'empty' ? '⬜' : type === 'wall' ? '🧱' : type === 'start' ? '🤖' : type === 'target' ? '🏁' : type === 'trap' ? '🔥' : '💰'}
                </button>
              ))}

              {drawMode === 'bonus' && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginLeft: '0.5rem', paddingLeft: '0.5rem', borderLeft: '1px solid #334155' }}>
                  <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>Награда:</span>
                  <input
                    type="number"
                    value={bonusValue}
                    onChange={e => setBonusValue(parseInt(e.target.value) || 0)}
                    style={{ width: '60px', padding: '2px 6px', fontSize: '0.8rem' }}
                  />
                </div>
              )}
            </div>
          </div>
        )}

        <div className="panel" style={{ flex: 1, padding: 0, overflow: 'hidden' }}>
          <CanvasGrid
            width={state.env.width}
            height={state.env.height}
            cells={state.env.cells}
            agentPos={state.agent_pos}
            qTable={state.q_table}
            showHeatmap={showHeatmap}
            showArrows={showArrows}
            showNumbers={showNumbers}
            onCellClick={(x, y) => handleCellAction(x, y, false)}
            onCellDrag={(x, y) => handleCellAction(x, y, true)}
            onDrawEnd={handleSyncMap}
            optimalPath={optimalPath}
            showPath={showPath}
            hideCellContents={hideCellContents}
            smoothHeatmap={smoothHeatmap}
            showMinima={showMinima}
            theme={theme}
            updateVersion={state.update_version}
          />
        </div>
      </main>

      <aside className="sidebar-right">
        <div className="panel" style={{ height: '100%' }}>
          <h2 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}><Activity size={20} /> Аналитика</h2>

          <div className="card" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', textAlign: 'center' }}>
            <div>
              <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Эпизод</div>
              <div style={{ fontSize: '1.1rem', fontWeight: 'bold' }}>{state.episode}</div>
            </div>
            <div>
              <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Шаги</div>
              <div style={{ fontSize: '1.1rem', fontWeight: 'bold' }}>{state.steps}</div>
            </div>
            <div>
              <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Награда</div>
              <div style={{ fontSize: '1.1rem', fontWeight: 'bold', color: state.total_reward >= 0 ? '#22c55e' : '#ef4444' }}>{state.total_reward.toFixed(1)}</div>
            </div>
            <div>
              <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Epsilon</div>
              <div style={{ fontSize: '1.1rem', fontWeight: 'bold' }}>{state.epsilon.toFixed(3)}</div>
            </div>
          </div>

          <div style={{ flex: 1, minHeight: 0, marginTop: '1rem' }}>
            <Charts data={curve} theme={theme} />
          </div>
        </div>
      </aside>

      <div className="floating-controls">
        <button
          className="floating-btn"
          onClick={() => setUiHidden(!uiHidden)}
          title={uiHidden ? "Показать интерфейс (F1)" : "Скрыть интерфейс (F1)"}
        >
          {uiHidden ? <Eye size={20} /> : <EyeOff size={20} />}
        </button>
        <button
          className="floating-btn"
          onClick={toggleFullscreen}
          title={isFullscreen ? "Выйти из полноэкранного режима (F11)" : "На весь экран (F11)"}
        >
          {isFullscreen ? <Minimize2 size={20} /> : <Maximize2 size={20} />}
        </button>
      </div>
    </div>
  );
}

export default App;
