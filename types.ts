
export interface SystemStatus {
  cpu: number;
  memory: number;
  network: string;
  integrity: number;
  volume: number;
}

export enum ConnectionState {
  DISCONNECTED = 'DISCONNECTED',
  CONNECTING = 'CONNECTING',
  CONNECTED = 'CONNECTED',
  ERROR = 'ERROR'
}

export interface LogEntry {
  id: string;
  timestamp: string;
  source: 'SYSTEM' | 'USER' | 'JARVIS';
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
}

export interface AudioVisualizerData {
  volume: number; // 0 to 1
}

declare global {
  interface AIStudio {
    hasSelectedApiKey: () => Promise<boolean>;
    openSelectKey: () => Promise<void>;
  }

  interface Window {
    aistudio?: AIStudio;
  }
}
