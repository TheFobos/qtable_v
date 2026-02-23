import type { SetupConfig, SimulationState, LearningCurvePoint } from './types';

const API_BASE = 'http://localhost:8000/api';
const WS_URL = 'ws://localhost:8000/ws';

export class APIClient {
    static async setup(config: SetupConfig) {
        const res = await fetch(`${API_BASE}/setup`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(config)
        });
        return res.json();
    }

    static async updateConfig(config: SetupConfig) {
        const res = await fetch(`${API_BASE}/config`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(config)
        });
        return res.json();
    }

    static async getState(): Promise<SimulationState> {
        const res = await fetch(`${API_BASE}/state`);
        return res.json();
    }

    static async step() {
        const res = await fetch(`${API_BASE}/step`, { method: 'POST' });
        return res.json();
    }

    static async turbo(episodes: number): Promise<{ status: string, curve: LearningCurvePoint[], env: any }> {
        const res = await fetch(`${API_BASE}/turbo?episodes=${episodes}`, { method: 'POST' });
        return res.json();
    }

    static async generateMaze(): Promise<{ status: string, env: any }> {
        const res = await fetch(`${API_BASE}/maze`, { method: 'POST' });
        return res.json();
    }

    static async clearMap(): Promise<{ status: string, env: any }> {
        const res = await fetch(`${API_BASE}/clear`, { method: 'POST' });
        return res.json();
    }

    static async getPath(): Promise<{ path: { x: number, y: number }[] }> {
        const res = await fetch(`${API_BASE}/path`);
        return res.json();
    }
}

export class WSClient {
    private ws: WebSocket | null = null;
    private onMessageCb: ((data: any) => void) | null = null;

    connect(onMessage: (data: any) => void) {
        this.onMessageCb = onMessage;
        this.ws = new WebSocket(WS_URL);
        this.ws.onmessage = (event) => {
            if (this.onMessageCb) {
                this.onMessageCb(JSON.parse(event.data));
            }
        };
        this.ws.onclose = () => {
            console.log("WS closed, reconnecting in 1s...");
            setTimeout(() => this.connect(onMessage), 1000);
        };
        this.ws.onerror = (err) => console.error("WS Error", err);
    }

    disconnect() {
        if (this.ws) {
            this.ws.onclose = null;
            this.ws.close();
        }
    }

    play() {
        if (this.ws?.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify({ action: 'play' }));
        }
    }

    pause() {
        if (this.ws?.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify({ action: 'pause' }));
        }
    }

    setSpeed(speed: number) {
        if (this.ws?.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify({ action: 'set_speed', speed }));
        }
    }
}
