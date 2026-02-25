import { io, Socket } from 'socket.io-client';

const WS_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:3000';

export type WebSocketEventHandler = (data: any) => void;

class WebSocketClient {
  private socket: Socket | null = null;
  private currentWorkspaceId: string | null = null;

  connect(): void {
    if (this.socket?.connected) return;

    this.socket = io(WS_URL, {
      path: '/api/socket.io', // Use /api prefix to work with proxy
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 5,
    });

    this.socket.on('connect', () => {
      console.log('WebSocket connected');

      // Rejoin workspace if was in one
      if (this.currentWorkspaceId) {
        this.joinWorkspace(this.currentWorkspaceId);
      }
    });

    this.socket.on('disconnect', () => {
      console.log('WebSocket disconnected');
    });

    this.socket.on('error', (error) => {
      console.error('WebSocket error:', error);
    });
  }

  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.currentWorkspaceId = null;
    }
  }

  joinWorkspace(workspaceId: string): void {
    if (!this.socket) {
      console.error('WebSocket not connected');
      return;
    }

    this.socket.emit('join_workspace', { workspace_id: workspaceId });
    this.currentWorkspaceId = workspaceId;
  }

  leaveWorkspace(workspaceId: string): void {
    if (!this.socket) return;

    this.socket.emit('leave_workspace', { workspace_id: workspaceId });
    if (this.currentWorkspaceId === workspaceId) {
      this.currentWorkspaceId = null;
    }
  }

  on(event: string, handler: WebSocketEventHandler): void {
    if (!this.socket) {
      console.error('WebSocket not connected');
      return;
    }

    this.socket.on(event, handler);
  }

  off(event: string, handler?: WebSocketEventHandler): void {
    if (!this.socket) return;

    if (handler) {
      this.socket.off(event, handler);
    } else {
      this.socket.off(event);
    }
  }

  emit(event: string, data: any): void {
    if (!this.socket) {
      console.error('WebSocket not connected');
      return;
    }

    this.socket.emit(event, data);
  }

  ping(): void {
    this.emit('ping', {});
  }

  isConnected(): boolean {
    return this.socket?.connected ?? false;
  }
}

export const wsClient = new WebSocketClient();
