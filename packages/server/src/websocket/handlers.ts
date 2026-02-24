import { Server as SocketIOServer, Socket } from 'socket.io';
import { WorkspaceRepository } from '../db/repositories';

const workspaceRepo = new WorkspaceRepository();

export function setupWebSocketHandlers(io: SocketIOServer) {
  io.on('connection', (socket: Socket) => {
    console.log(`Client connected: ${socket.id}`);

    // Join workspace room
    socket.on('join_workspace', async (data: { workspace_id: string }) => {
      const { workspace_id } = data;

      // Verify workspace exists
      const workspace = await workspaceRepo.findById(workspace_id);
      if (!workspace) {
        socket.emit('error', { message: 'Workspace not found' });
        return;
      }

      socket.join(workspace_id);
      console.log(`Socket ${socket.id} joined workspace ${workspace_id}`);

      socket.emit('workspace_joined', { workspace_id, workspace });
    });

    // Leave workspace room
    socket.on('leave_workspace', (data: { workspace_id: string }) => {
      const { workspace_id } = data;
      socket.leave(workspace_id);
      console.log(`Socket ${socket.id} left workspace ${workspace_id}`);
    });

    // Ping/pong for connection health
    socket.on('ping', () => {
      socket.emit('pong', { timestamp: Date.now() });
    });

    // Handle disconnect
    socket.on('disconnect', () => {
      console.log(`Client disconnected: ${socket.id}`);
    });
  });

  return io;
}

// Broadcast to workspace
export function broadcastToWorkspace(
  io: SocketIOServer,
  workspaceId: string,
  event: string,
  data: any
) {
  io.to(workspaceId).emit(event, data);
  console.log(`Broadcasted ${event} to workspace ${workspaceId}`);
}

// Broadcast conflict detected
export function broadcastConflict(
  io: SocketIOServer,
  workspaceId: string,
  conflict: any
) {
  broadcastToWorkspace(io, workspaceId, 'conflict_detected', {
    conflict,
    timestamp: new Date().toISOString()
  });
}

// Broadcast Figma changes
export function broadcastFigmaChanges(
  io: SocketIOServer,
  workspaceId: string,
  fileId: string,
  changes: any[]
) {
  broadcastToWorkspace(io, workspaceId, 'figma_changes', {
    file_id: fileId,
    changes,
    timestamp: new Date().toISOString()
  });
}

// Broadcast sync status
export function broadcastSyncStatus(
  io: SocketIOServer,
  workspaceId: string,
  fileId: string,
  status: string,
  error?: string
) {
  broadcastToWorkspace(io, workspaceId, 'sync_status', {
    file_id: fileId,
    status,
    error,
    timestamp: new Date().toISOString()
  });
}
