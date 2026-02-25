import { Server as SocketIOServer, Socket } from 'socket.io';
import { WorkspaceRepository } from '../db/repositories';
import pool from '../db/connection';
import { randomUUID } from 'crypto';

const workspaceRepo = new WorkspaceRepository();

// Track connected plugins
const connectedPlugins = new Map<string, {
  socketId: string;
  plugin: string;
  connectedAt: Date;
  lastHeartbeat: Date;
  fileKey?: string;
}>();

export function setupWebSocketHandlers(io: SocketIOServer) {
  io.on('connection', (socket: Socket) => {
    console.log(`Client connected: ${socket.id}`);
    let pluginId: string | null = null;

    // Plugin connection
    socket.on('plugin-connect', (data: { plugin: string; timestamp: string }) => {
      pluginId = socket.id;
      connectedPlugins.set(pluginId, {
        socketId: socket.id,
        plugin: data.plugin,
        connectedAt: new Date(),
        lastHeartbeat: new Date()
      });

      console.log(`✅ Plugin connected: ${data.plugin} (${socket.id})`);

      // Broadcast plugin status to all clients
      io.emit('plugin-status', {
        connected: true,
        plugin: data.plugin,
        count: connectedPlugins.size
      });

      socket.emit('plugin-connected', {
        success: true,
        pluginId: socket.id
      });
    });

    // Heartbeat from plugin
    socket.on('heartbeat', () => {
      if (pluginId && connectedPlugins.has(pluginId)) {
        const plugin = connectedPlugins.get(pluginId)!;
        plugin.lastHeartbeat = new Date();
        connectedPlugins.set(pluginId, plugin);
      }
    });

    // Design system sync from plugin
    socket.on('design-system-sync', async (data: any) => {
      console.log('🔄 Received design system sync from plugin');
      console.log(`📊 File: ${data.data.file.name} (${data.data.file.key})`);
      console.log(`📦 Variables: ${data.data.variables.length}, Collections: ${data.data.collections.length}, Components: ${data.data.components.length}`);

      try {
        const { file, variables, collections, components } = data.data;

        // Find Figma file in database by key
        const figmaFileResult = await pool.query(
          'SELECT * FROM figma_files WHERE figma_key = $1 LIMIT 1',
          [file.key]
        );

        if (figmaFileResult.rows.length === 0) {
          socket.emit('sync-error', {
            error: 'Figma file not found in database. Please add it via dashboard first.'
          });
          return;
        }

        const figmaFile = figmaFileResult.rows[0];

        // Save variable collections
        for (const collection of collections) {
          await pool.query(
            `INSERT INTO variable_collections (id, workspace_id, figma_file_id, name, figma_key, modes)
             VALUES ($1, $2, $3, $4, $5, $6)
             ON CONFLICT (figma_key) DO UPDATE SET
               name = EXCLUDED.name,
               modes = EXCLUDED.modes,
               updated_at = NOW()`,
            [
              randomUUID(),
              figmaFile.workspace_id,
              figmaFile.id,
              collection.name,
              collection.key,
              JSON.stringify(collection.modes)
            ]
          );
        }

        // Save variables
        for (const variable of variables) {
          await pool.query(
            `INSERT INTO variables (id, workspace_id, figma_file_id, name, figma_key, type, value, collection_id, scopes)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
             ON CONFLICT (figma_key) DO UPDATE SET
               name = EXCLUDED.name,
               type = EXCLUDED.type,
               value = EXCLUDED.value,
               updated_at = NOW()`,
            [
              randomUUID(),
              figmaFile.workspace_id,
              figmaFile.id,
              variable.name,
              variable.key,
              variable.resolvedType,
              JSON.stringify(variable.valuesByMode),
              variable.variableCollectionId,
              JSON.stringify([])
            ]
          );
        }

        // Save components
        for (const component of components) {
          await pool.query(
            `INSERT INTO components (id, workspace_id, figma_file_id, name, figma_key, description, type, properties)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
             ON CONFLICT (figma_key) DO UPDATE SET
               name = EXCLUDED.name,
               description = EXCLUDED.description,
               updated_at = NOW()`,
            [
              randomUUID(),
              figmaFile.workspace_id,
              figmaFile.id,
              component.name,
              component.key,
              component.description || '',
              'component',
              JSON.stringify({ parent: component.parent })
            ]
          );
        }

        // Update file sync status
        await pool.query(
          `UPDATE figma_files SET
             sync_status = 'success',
             last_synced = NOW(),
             updated_at = NOW()
           WHERE id = $1`,
          [figmaFile.id]
        );

        console.log(`✅ Sync completed: ${variables.length} variables, ${components.length} components saved`);

        // Send success to plugin
        socket.emit('sync-complete', {
          success: true,
          message: `Synced ${variables.length} variables and ${components.length} components`,
          stats: {
            variables: variables.length,
            collections: collections.length,
            components: components.length
          }
        });

        // Broadcast to workspace
        io.to(figmaFile.workspace_id).emit('figma_synced', {
          fileId: figmaFile.id,
          fileName: file.name,
          stats: {
            variables: variables.length,
            collections: collections.length,
            components: components.length
          },
          timestamp: new Date().toISOString()
        });

      } catch (error) {
        console.error('❌ Sync error:', error);
        socket.emit('sync-error', {
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    });

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

      // Remove plugin if it was a plugin connection
      if (pluginId && connectedPlugins.has(pluginId)) {
        const plugin = connectedPlugins.get(pluginId)!;
        connectedPlugins.delete(pluginId);
        console.log(`❌ Plugin disconnected: ${plugin.plugin} (${socket.id})`);

        // Broadcast plugin status
        io.emit('plugin-status', {
          connected: false,
          plugin: plugin.plugin,
          count: connectedPlugins.size
        });
      }
    });
  });

  return io;
}

// Get connected plugins status
export function getConnectedPluginsStatus() {
  return {
    count: connectedPlugins.size,
    plugins: Array.from(connectedPlugins.values()).map(p => ({
      plugin: p.plugin,
      connectedAt: p.connectedAt,
      lastHeartbeat: p.lastHeartbeat,
      fileKey: p.fileKey
    }))
  };
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
