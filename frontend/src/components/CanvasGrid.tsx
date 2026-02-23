import { useRef, useEffect } from 'react';
import type { CellType, QTable, AgentPos } from '../types';

interface CanvasGridProps {
    width: number;
    height: number;
    cells: string[][];
    agentPos: AgentPos | null;
    qTable: QTable;
    showHeatmap: boolean;
    showArrows: boolean;
    showNumbers: boolean;
    onCellClick: (x: number, y: number) => void;
    onCellDrag: (x: number, y: number) => void;
    onDrawEnd?: () => void;
    optimalPath?: { x: number, y: number }[];
    showPath?: boolean;
    hideCellContents?: boolean;
    smoothHeatmap?: boolean;
    showMinima?: boolean;
    theme?: 'dark' | 'light';
    updateVersion?: number;
}

const getColors = (theme: 'dark' | 'light'): Record<CellType, string> => ({
    empty: theme === 'dark' ? '#1e293b' : '#ffffff',
    wall: theme === 'dark' ? '#475569' : '#94a3b8',
    start: '#3b82f6',
    target: '#22c55e',
    trap: '#ef4444',
    bonus: '#eab308'
});

export function CanvasGrid({
    width, height, cells, agentPos, qTable,
    showHeatmap, showArrows, showNumbers,
    onCellClick, onCellDrag, onDrawEnd, optimalPath, showPath,
    hideCellContents = false, smoothHeatmap = false, showMinima = false,
    theme = 'dark', updateVersion
}: CanvasGridProps) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const bgCanvasRef = useRef<HTMLCanvasElement | null>(null);
    const isDragging = useRef(false);

    useEffect(() => {
        const canvas = canvasRef.current;
        const container = containerRef.current;
        if (!canvas || !container) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        if (!bgCanvasRef.current) {
            bgCanvasRef.current = document.createElement('canvas');
        }
        const bgCanvas = bgCanvasRef.current;
        const bgCtx = bgCanvas.getContext('2d');
        if (!bgCtx) return;

        const renderBackground = (bCtx: CanvasRenderingContext2D, cWidth: number, cHeight: number) => {
            const cellW = cWidth / width;
            const cellH = cHeight / height;
            const COLORS = getColors(theme);

            bCtx.clearRect(0, 0, cWidth, cHeight);
            bCtx.textAlign = 'center';
            bCtx.textBaseline = 'middle';

            for (let y = 0; y < height; y++) {
                for (let x = 0; x < width; x++) {
                    const cx = x * cellW;
                    const cy = y * cellH;
                    const cell_str = cells[y]?.[x] || 'empty';
                    const cType = cell_str.startsWith('bonus') ? 'bonus' as CellType : cell_str as CellType;

                    // Base Color
                    bCtx.fillStyle = COLORS[cType] || COLORS.empty;
                    bCtx.fillRect(cx, cy, cellW, cellH);

                    // Grid Line (if large enough)
                    if (cellW > 5) {
                        bCtx.strokeStyle = theme === 'dark' ? '#0f172a' : '#e2e8f0';
                        bCtx.lineWidth = 0.5;
                        bCtx.strokeRect(cx, cy, cellW, cellH);
                    }

                    // Emojis for special cells
                    if (!hideCellContents && cType !== 'empty' && cellW > 10) {
                        bCtx.fillStyle = '#ffffff';
                        bCtx.font = `${Math.min(cellW, cellH) * 0.6}px Arial`;
                        let emoji = '';
                        if (cType === 'target') emoji = '🏁';
                        else if (cType === 'wall') emoji = '🧱';
                        else if (cType === 'trap') emoji = '🔥';
                        else if (cType === 'bonus') emoji = '💰';
                        if (emoji) bCtx.fillText(emoji, cx + cellW / 2, cy + cellH / 2 + cellH * 0.1);

                        // Draw value for bonus
                        if (cType === 'bonus' && cellW > 25) {
                            const val = cell_str.includes(':') ? cell_str.split(':')[1] : '20';
                            bCtx.fillStyle = '#ffffff';
                            bCtx.font = `bold ${Math.min(cellW, cellH) * 0.25}px Arial`;
                            bCtx.fillText(`+${val}`, cx + cellW / 2, cy + cellH * 0.85);
                        }
                    }
                }
            }
        };

        const drawAll = () => {
            const rect = container.getBoundingClientRect();
            const cellAspect = width / height;
            const containerAspect = rect.width / rect.height;
            let cWidth, cHeight;
            if (containerAspect > cellAspect) {
                cHeight = rect.height;
                cWidth = cHeight * cellAspect;
            } else {
                cWidth = rect.width;
                cHeight = cWidth / cellAspect;
            }

            const cellW = cWidth / width;
            const cellH = cHeight / height;

            // Clear & Draw Cached Background
            ctx.clearRect(0, 0, cWidth, cHeight);
            ctx.drawImage(bgCanvas, 0, 0, cWidth, cHeight);

            // Draw Heatmap / Q-values
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';

            if (showHeatmap && smoothHeatmap) {
                // Smooth Heatmap Implementation using low-res offscreen canvas
                const offCanvas = document.createElement('canvas');
                offCanvas.width = width;
                offCanvas.height = height;
                const offCtx = offCanvas.getContext('2d');
                if (offCtx) {
                    const imgData = offCtx.createImageData(width, height);
                    for (let y = 0; y < height; y++) {
                        for (let x = 0; x < width; x++) {
                            const qVals = qTable[`${x},${y}`];
                            const idx = (y * width + x) * 4;
                            if (qVals) {
                                const q_u = qVals.UP || 0;
                                const q_d = qVals.DOWN || 0;
                                const q_l = qVals.LEFT || 0;
                                const q_r = qVals.RIGHT || 0;
                                const maxQ = Math.max(q_u, q_d, q_l, q_r);
                                const minQ = Math.min(q_u, q_d, q_l, q_r);

                                if (maxQ > 0) {
                                    const alpha = Math.min(maxQ / 100 * 255, 200);
                                    imgData.data[idx] = 34;    // R
                                    imgData.data[idx + 1] = 197; // G
                                    imgData.data[idx + 2] = 94;  // B
                                    imgData.data[idx + 3] = alpha;
                                } else if (showMinima && minQ < 0) {
                                    const alpha = Math.min(Math.abs(minQ) / 100 * 255, 200);
                                    imgData.data[idx] = 239;
                                    imgData.data[idx + 1] = 68;
                                    imgData.data[idx + 2] = 68;
                                    imgData.data[idx + 3] = alpha;
                                } else if (maxQ < 0) {
                                    const alpha = Math.min(Math.abs(maxQ) / 100 * 255, 200);
                                    imgData.data[idx] = 239;
                                    imgData.data[idx + 1] = 68;
                                    imgData.data[idx + 2] = 68;
                                    imgData.data[idx + 3] = alpha;
                                }
                            }
                        }
                    }
                    offCtx.putImageData(imgData, 0, 0);
                    ctx.imageSmoothingEnabled = true;
                    ctx.drawImage(offCanvas, 0, 0, cWidth, cHeight);
                }
            }

            for (let y = 0; y < height; y++) {
                for (let x = 0; x < width; x++) {
                    const cell_str = cells[y]?.[x] || 'empty';
                    const cType = cell_str.startsWith('bonus') ? 'bonus' : cell_str as CellType;
                    if (cType !== 'empty') continue;

                    const stateKey = `${x},${y}`;
                    const qVals = qTable[stateKey];
                    if (!qVals) continue;

                    const cx = x * cellW;
                    const cy = y * cellH;
                    const q_u = qVals.UP || 0;
                    const q_d = qVals.DOWN || 0;
                    const q_l = qVals.LEFT || 0;
                    const q_r = qVals.RIGHT || 0;
                    const maxQ = Math.max(q_u, q_d, q_l, q_r);
                    const minQ = Math.min(q_u, q_d, q_l, q_r);
                    const active = maxQ !== 0 || minQ !== 0 || Object.values(qVals).some(v => v !== 0);

                    if (active) {
                        if (showHeatmap && !smoothHeatmap) {
                            const alpha = Math.min(Math.abs(maxQ) / 100, 0.8);
                            if (maxQ > 0) {
                                ctx.fillStyle = `rgba(34, 197, 94, ${alpha})`;
                            } else if (showMinima && minQ < 0) {
                                const minAlpha = Math.min(Math.abs(minQ) / 100, 0.8);
                                ctx.fillStyle = `rgba(239, 68, 68, ${minAlpha})`;
                            } else {
                                ctx.fillStyle = `rgba(239, 68, 68, ${alpha})`;
                            }
                            ctx.fillRect(cx, cy, cellW, cellH);
                        } else if (showMinima && !smoothHeatmap && minQ < -5) {
                            // Secondary red overlay for avoidance if heatmap is off but minima is on
                            const minAlpha = Math.min(Math.abs(minQ) / 100, 0.4);
                            ctx.fillStyle = `rgba(239, 68, 68, ${minAlpha})`;
                            ctx.fillRect(cx, cy, cellW, cellH);
                        }
                        if (showArrows && cellW > 15) {
                            let best = '';
                            if (qVals.UP === maxQ) best = '⬆️';
                            else if (qVals.DOWN === maxQ) best = '⬇️';
                            else if (qVals.LEFT === maxQ) best = '⬅️';
                            else if (qVals.RIGHT === maxQ) best = '➡️';
                            ctx.fillStyle = theme === 'dark' ? 'rgba(255, 255, 255, 0.8)' : 'rgba(15, 23, 42, 0.8)';
                            ctx.font = `${Math.min(cellW, cellH) * 0.4}px Arial`;
                            ctx.fillText(best, cx + cellW / 2, cy + cellH / 2);
                        }
                        if (showNumbers && cellW > 30) {
                            ctx.fillStyle = theme === 'dark' ? 'rgba(255, 255, 255, 0.7)' : 'rgba(15, 23, 42, 0.7)';
                            ctx.font = `${Math.min(cellW, cellH) * 0.2}px Arial`;
                            ctx.fillText(qVals.UP.toFixed(1), cx + cellW / 2, cy + cellH * 0.15);
                            ctx.fillText(qVals.DOWN.toFixed(1), cx + cellW / 2, cy + cellH * 0.85);
                            ctx.fillText(qVals.LEFT.toFixed(1), cx + cellW * 0.15, cy + cellH / 2);
                            ctx.fillText(qVals.RIGHT.toFixed(1), cx + cellW * 0.85, cy + cellH / 2);
                        }
                    }
                }
            }

            // Draw Agent
            if (agentPos && !hideCellContents) {
                const ax = agentPos.x * cellW, ay = agentPos.y * cellH;
                ctx.fillStyle = '#a855f7';
                ctx.beginPath();
                ctx.arc(ax + cellW / 2, ay + cellH / 2, Math.min(cellW, cellH) * 0.4, 0, Math.PI * 2);
                ctx.fill();
                if (cellW > 15) {
                    ctx.font = `${Math.min(cellW, cellH) * 0.5}px Arial`;
                    ctx.fillText('🤖', ax + cellW / 2, ay + cellH / 2);
                }
            }

            // Draw Optimal Path
            if (showPath && optimalPath && optimalPath.length > 1) {
                ctx.beginPath();
                ctx.strokeStyle = '#f472b6';
                ctx.lineWidth = Math.min(cellW, cellH) * 0.15;
                ctx.lineJoin = 'round';
                ctx.lineCap = 'round';
                ctx.moveTo(optimalPath[0].x * cellW + cellW / 2, optimalPath[0].y * cellH + cellH / 2);
                for (let i = 1; i < optimalPath.length; i++) {
                    ctx.lineTo(optimalPath[i].x * cellW + cellW / 2, optimalPath[i].y * cellH + cellH / 2);
                }
                ctx.stroke();
            }
        };

        const updateSize = () => {
            const rect = container.getBoundingClientRect();
            const cellAspect = width / height;
            const containerAspect = rect.width / rect.height;

            let canvasWidth, canvasHeight;
            if (containerAspect > cellAspect) {
                canvasHeight = rect.height;
                canvasWidth = canvasHeight * cellAspect;
            } else {
                canvasWidth = rect.width;
                canvasHeight = canvasWidth / cellAspect;
            }

            const dpr = window.devicePixelRatio || 1;
            canvas.width = canvasWidth * dpr;
            canvas.height = canvasHeight * dpr;
            canvas.style.width = `${canvasWidth}px`;
            canvas.style.height = `${canvasHeight}px`;

            bgCanvas.width = canvas.width;
            bgCanvas.height = canvas.height;
            if (bgCtx) {
                bgCtx.scale(dpr, dpr);
                renderBackground(bgCtx, canvasWidth, canvasHeight);
            }

            ctx.scale(dpr, dpr);
            drawAll();
        };

        const resizeObserver = new ResizeObserver(() => updateSize());
        resizeObserver.observe(container);
        updateSize(); // Initial draw

        return () => resizeObserver.disconnect();
    }, [width, height, cells, agentPos, qTable, showHeatmap, showArrows, showNumbers, optimalPath, showPath, hideCellContents, smoothHeatmap, showMinima, theme, updateVersion]);

    const handleMouseEvent = (e: React.MouseEvent<HTMLCanvasElement>, type: 'click' | 'drag') => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const rect = canvas.getBoundingClientRect();
        const cellW = rect.width / width;
        const cellH = rect.height / height;

        const x = Math.floor((e.clientX - rect.left) / cellW);
        const y = Math.floor((e.clientY - rect.top) / cellH);

        if (x >= 0 && x < width && y >= 0 && y < height) {
            if (type === 'click') onCellClick(x, y);
            else if (type === 'drag' && isDragging.current) onCellDrag(x, y);
        }
    };

    return (
        <div
            ref={containerRef}
            style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        >
            <canvas
                ref={canvasRef}
                style={{ cursor: 'pointer', borderRadius: '4px', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }}
                onMouseDown={(e) => { isDragging.current = true; handleMouseEvent(e, 'click'); }}
                onMouseMove={(e) => handleMouseEvent(e, 'drag')}
                onMouseUp={() => { isDragging.current = false; onDrawEnd?.(); }}
                onMouseLeave={() => { isDragging.current = false; }}
            />
        </div>
    );
}
