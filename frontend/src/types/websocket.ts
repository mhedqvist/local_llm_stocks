export type ConnectionStatus = 'CONNECTING' | 'CONNECTED' | 'DISCONNECTED' | 'RECONNECTING' | 'INACTIVE';

export interface PriceUpdateMessage {
  type: 'PRICE_UPDATE';
  symbol: string;
  data: {
    time: number;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
  };
}

export interface SystemStatusMessage {
  type: 'SYSTEM_STATUS';
  status: ConnectionStatus;
}

export type WebSocketMessage = PriceUpdateMessage | SystemStatusMessage;
