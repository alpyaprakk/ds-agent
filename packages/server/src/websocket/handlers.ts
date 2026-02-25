import { Server as SocketIOServer, Socket } from 'socket.io';
import { WorkspaceRepository } from '../db/repositories';
import { NotificationService } from '../services/notification.service';
import pool from '../db/connection';
import { randomUUID } from 'crypto';
import { AIAnalyzer, DesignSystemData } from '../services/ai-analyzer';
import { verifyToken } from '../middleware/auth';

const workspaceRepo = new WorkspaceRepository();

// Store IO instance for access from other modules
let ioInstance: SocketIOServer | null = null;

export function getIO(): SocketIOServer | null {
  return ioInstance;
}

// Track connected plugins
const connectedPlugins = new Map<string, {
  socketId: string;
  plugin: string;
  connectedAt: Date;
  lastHeartbeat: Date;
  fileKey?: string;
}>();

export function setupWebSocketHandlers(io: SocketIOServer) {
  ioInstance = io;

  // Socket.IO authentication middleware
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token || socket.handshake.query?.token;
    const isPlugin = socket.handshake.query?.plugin === 'true';

    // Allow plugin connections without auth (they use plugin-connect event)
    if (isPlugin) {
      (socket as any).isPlugin = true;
      return next();
    }

    if (!token) {
      return next(new Error('Authentication required'));
    }

    try {
      const user = verifyToken(token as string);
      (socket as any).user = user;
      return next();
    } catch {
      return next(new Error('Invalid or expired token'));
    }
  });

  io.on('connection', (socket: Socket) => {
    const user = (socket as any).user;
    const isPlugin = (socket as any).isPlugin;
    console.log(`Client connected: ${socket.id}${user ? ` (user: ${user.id})` : ''}${isPlugin ? ' (plugin)' : ''}`);

    // Join user-specific room for targeted notifications
    if (user) {
      socket.join(`user:${user.id}`);
    }
    let pluginId: string | null = null;

    // Send current plugin status to newly connected client
    const currentStatus = {
      connected: connectedPlugins.size > 0,
      plugin: connectedPlugins.size > 0 ? Array.from(connectedPlugins.values())[0].plugin : 'none',
      count: connectedPlugins.size
    };
    console.log(`📤 Sending current plugin status to ${socket.id}:`, currentStatus);
    socket.emit('plugin-status', currentStatus);

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
      const statusData = {
        connected: true,
        plugin: data.plugin,
        count: connectedPlugins.size
      };
      console.log(`📡 Broadcasting plugin-status:`, statusData);
      io.emit('plugin-status', statusData);

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

      try {
        // Handle both wrapped { data: {...} } and unwrapped { file, variables, ... } formats
        const syncPayload = data.data || data;
        const { file, variables, collections, components } = syncPayload;

        if (!file || !variables || !collections || !components) {
          console.error('❌ Invalid sync data format:', Object.keys(data));
          socket.emit('sync-error', {
            error: 'Invalid sync data format. Missing required fields.'
          });
          return;
        }

        console.log(`📊 File: ${file.name} (${file.key})`);
        console.log(`📦 Variables: ${variables.length}, Collections: ${collections.length}, Components: ${components.length}`);

        // Find Figma file in database by key
        // If key is "unknown" (dev mode), try to match by file name first
        let figmaFileResult;
        if (file.key === 'unknown') {
          console.log(`⚠️ File key is "unknown" (dev mode plugin). Matching by name: ${file.name}`);
          figmaFileResult = await pool.query(
            `SELECT * FROM figma_files WHERE name = $1 AND figma_key != 'unknown' LIMIT 1`,
            [file.name]
          );
          // If no match by name with real key, try the unknown one
          if (figmaFileResult.rows.length === 0) {
            figmaFileResult = await pool.query(
              `SELECT * FROM figma_files WHERE name = $1 LIMIT 1`,
              [file.name]
            );
          }
          // Fallback: if still not found, match any file currently in 'syncing' status
          // (dashboard triggered sync sets status to 'syncing' before plugin responds)
          if (figmaFileResult.rows.length === 0) {
            figmaFileResult = await pool.query(
              `SELECT * FROM figma_files WHERE sync_status = 'syncing' ORDER BY updated_at DESC LIMIT 1`
            );
            if (figmaFileResult.rows.length > 0) {
              console.log(`⚠️ Matched syncing file by status fallback: ${figmaFileResult.rows[0].name}`);
            }
          }
        } else {
          figmaFileResult = await pool.query(
            'SELECT * FROM figma_files WHERE figma_key = $1 LIMIT 1',
            [file.key]
          );
          // Fallback: if key doesn't match, try by name
          if (figmaFileResult.rows.length === 0) {
            figmaFileResult = await pool.query(
              `SELECT * FROM figma_files WHERE name = $1 LIMIT 1`,
              [file.name]
            );
          }
        }

        // Auto-register: if file not found, create it in the first available workspace
        if (figmaFileResult.rows.length === 0) {
          console.log(`⚠️ Figma file not found in DB. Auto-registering: ${file.name} (${file.key})`);

          // Find first workspace to associate with
          const workspaceResult = await pool.query(
            'SELECT id FROM workspaces ORDER BY created_at ASC LIMIT 1'
          );

          if (workspaceResult.rows.length === 0) {
            socket.emit('sync-error', {
              error: 'No workspace found. Please create a workspace in the dashboard first.'
            });
            return;
          }

          const workspaceId = workspaceResult.rows[0].id;

          // Create the Figma file record
          figmaFileResult = await pool.query(
            `INSERT INTO figma_files (workspace_id, figma_key, name, url, role, type, sync_status)
             VALUES ($1, $2, $3, $4, 'primary', 'design_system', 'syncing')
             ON CONFLICT (workspace_id, figma_key) DO UPDATE SET name = EXCLUDED.name
             RETURNING *`,
            [
              workspaceId,
              file.key,
              file.name,
              `https://www.figma.com/design/${file.key}`
            ]
          );

          console.log(`✅ Auto-registered Figma file: ${file.name} in workspace ${workspaceId}`);
        }

        const figmaFile = figmaFileResult.rows[0];

        // Set sync status to 'syncing' at the beginning
        await pool.query(
          `UPDATE figma_files SET sync_status = 'syncing', sync_error = NULL, updated_at = NOW() WHERE id = $1`,
          [figmaFile.id]
        );

        // Build variable ID → name lookup for resolving aliases in valuesByMode
        const varIdToName = new Map<string, string>();
        for (const v of variables) {
          varIdToName.set(v.id, v.name);
          if (!v.id.startsWith('VariableID:')) {
            varIdToName.set(`VariableID:${v.id}`, v.name);
          }
        }

        // Enrich alias references with resolved variable names
        for (const v of variables) {
          if (v.valuesByMode && typeof v.valuesByMode === 'object') {
            for (const modeKey of Object.keys(v.valuesByMode)) {
              const modeVal = v.valuesByMode[modeKey];
              if (modeVal && typeof modeVal === 'object' && modeVal.type === 'VARIABLE_ALIAS' && modeVal.id) {
                const resolved = varIdToName.get(modeVal.id);
                if (resolved) {
                  modeVal.name = resolved;
                }
              }
            }
          }
        }

        // Start transaction for batch inserts
        const client = await pool.connect();
        try {
          await client.query('BEGIN');

          // Batch save variable collections
          if (collections.length > 0) {
            const collectionValues = collections.map((_c: any, i: number) => {
              const baseIndex = i * 7;
              return `($${baseIndex + 1}, $${baseIndex + 2}, $${baseIndex + 3}, $${baseIndex + 4}, $${baseIndex + 5}, $${baseIndex + 6}, $${baseIndex + 7})`;
            }).join(',');

            const collectionParams = collections.flatMap((c: any) => [
              randomUUID(),
              figmaFile.workspace_id,
              figmaFile.id,
              c.name,
              c.key,
              c.id,
              JSON.stringify(c.modes)
            ]);

            await client.query(
              `INSERT INTO variable_collections (id, workspace_id, figma_file_id, name, figma_key, figma_id, modes)
               VALUES ${collectionValues}
               ON CONFLICT (workspace_id, figma_key) DO UPDATE SET
                 name = EXCLUDED.name,
                 figma_id = EXCLUDED.figma_id,
                 modes = EXCLUDED.modes,
                 updated_at = NOW()`,
              collectionParams
            );
          }

          // Batch save variables (in chunks of 100 to avoid parameter limit)
          const variableChunkSize = 100;
          for (let i = 0; i < variables.length; i += variableChunkSize) {
            const chunk = variables.slice(i, i + variableChunkSize);
            const variableValues = chunk.map((_: any, idx: number) => {
              const baseIndex = idx * 10;
              return `($${baseIndex + 1}, $${baseIndex + 2}, $${baseIndex + 3}, $${baseIndex + 4}, $${baseIndex + 5}, $${baseIndex + 6}, $${baseIndex + 7}, $${baseIndex + 8}, $${baseIndex + 9}, $${baseIndex + 10})`;
            }).join(',');

            const variableParams = chunk.flatMap((v: any) => [
              randomUUID(),
              figmaFile.workspace_id,
              figmaFile.id,
              v.name,
              v.key,
              v.id,
              v.resolvedType,
              JSON.stringify(v.valuesByMode),
              v.variableCollectionId,
              JSON.stringify([])
            ]);

            await client.query(
              `INSERT INTO variables (id, workspace_id, figma_file_id, name, figma_key, figma_id, type, value, collection_id, scopes)
               VALUES ${variableValues}
               ON CONFLICT (workspace_id, figma_key) DO UPDATE SET
                 name = EXCLUDED.name,
                 figma_id = EXCLUDED.figma_id,
                 type = EXCLUDED.type,
                 value = EXCLUDED.value,
                 updated_at = NOW()`,
              variableParams
            );
          }

          // Batch save components (in chunks of 100)
          const componentChunkSize = 100;
          for (let i = 0; i < components.length; i += componentChunkSize) {
            const chunk = components.slice(i, i + componentChunkSize);
            const componentValues = chunk.map((_: any, idx: number) => {
              const baseIndex = idx * 8;
              return `($${baseIndex + 1}, $${baseIndex + 2}, $${baseIndex + 3}, $${baseIndex + 4}, $${baseIndex + 5}, $${baseIndex + 6}, $${baseIndex + 7}, $${baseIndex + 8})`;
            }).join(',');

            const componentParams = chunk.flatMap((c: any) => [
              randomUUID(),
              figmaFile.workspace_id,
              figmaFile.id,
              c.name,
              c.key,
              c.description || '',
              'component',
              JSON.stringify({ parent: c.parent })
            ]);

            await client.query(
              `INSERT INTO components (id, workspace_id, figma_file_id, name, figma_key, description, type, properties)
               VALUES ${componentValues}
               ON CONFLICT (workspace_id, figma_key) DO UPDATE SET
                 name = EXCLUDED.name,
                 description = EXCLUDED.description,
                 updated_at = NOW()`,
              componentParams
            );
          }

          await client.query('COMMIT');
        } catch (err) {
          await client.query('ROLLBACK');
          throw err;
        } finally {
          client.release();
        }

        // Update file sync status and stats
        await pool.query(
          `UPDATE figma_files SET
             sync_status = 'success',
             last_synced = NOW(),
             stats = $2,
             updated_at = NOW()
           WHERE id = $1`,
          [figmaFile.id, JSON.stringify({
            variables: variables.length,
            collections: collections.length,
            components: components.length,
            lastSyncedAt: new Date().toISOString()
          })]
        );

        // Update workspace total counts from actual DB data
        await pool.query(
          `UPDATE workspaces SET
             total_variables = (SELECT COUNT(*) FROM variables WHERE workspace_id = $1),
             total_components = (SELECT COUNT(*) FROM components WHERE workspace_id = $1),
             updated_at = NOW()
           WHERE id = $1`,
          [figmaFile.workspace_id]
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

        // Broadcast to all clients so dashboard auto-refreshes
        const syncedData = {
          fileId: figmaFile.id,
          fileName: file.name,
          workspaceId: figmaFile.workspace_id,
          stats: {
            variables: variables.length,
            collections: collections.length,
            components: components.length
          },
          timestamp: new Date().toISOString()
        };
        io.emit('figma_synced', syncedData);

        // Notify workspace members about sync
        NotificationService.notifyWorkspaceMembers({
          workspaceId: figmaFile.workspace_id,
          type: 'figma_synced',
          title: `Figma file synced: ${file.name}`,
          message: `${variables.length} variables, ${components.length} components updated`,
          referenceType: 'figma_file',
          referenceId: figmaFile.id,
        }).catch(err => console.error('Failed to create sync notification:', err));

        // Trigger AI analysis (async, don't block sync response)
        analyzeDesignSystemAsync(io, figmaFile.workspace_id, figmaFile.id, syncPayload)
          .catch(err => console.error('❌ AI analysis failed:', err));

      } catch (error) {
        console.error('❌ Sync error:', error);
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';

        // Update file status to 'error' so it doesn't stay stuck on 'syncing'
        try {
          // Try to find the file by key to update its status
          const syncPayloadForError = data.data || data;
          if (syncPayloadForError?.file?.key) {
            await pool.query(
              `UPDATE figma_files SET sync_status = 'error', sync_error = $2, updated_at = NOW() WHERE figma_key = $1`,
              [syncPayloadForError.file.key, errorMsg]
            );
          }
        } catch (updateErr) {
          console.error('❌ Failed to update sync status on error:', updateErr);
        }

        socket.emit('sync-error', { error: errorMsg });
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

    // Apply fix request from dashboard
    socket.on('apply-fix', (data: any) => {
      console.log('🔧 Fix request received:', data);

      // Find connected plugin
      const plugin = Array.from(connectedPlugins.values())[0]; // Get first plugin
      if (!plugin) {
        socket.emit('fix-error', {
          error: 'No plugin connected. Please open the Figma plugin.'
        });
        return;
      }

      // Forward fix to plugin
      io.to(plugin.socketId).emit('apply-fix', data);
      console.log(`📤 Fix forwarded to plugin: ${plugin.plugin}`);
    });

    // Fix applied notification from plugin
    socket.on('fix-applied', async (data: { conflictId: string; success: boolean; error?: string }) => {
      console.log('✅ Fix applied notification:', data);

      if (data.success) {
        // Mark conflict as resolved
        try {
          await pool.query(
            `UPDATE conflicts SET
              status = 'resolved',
              resolution_method = 'auto',
              resolution_chosen = 'auto-fix',
              resolved_by = 'system',
              resolved_at = NOW()
             WHERE id = $1`,
            [data.conflictId]
          );

          // Broadcast to all clients
          io.emit('fix-success', {
            conflictId: data.conflictId,
            message: 'Fix applied successfully'
          });
        } catch (error) {
          console.error('Failed to update conflict:', error);
        }
      } else {
        // Broadcast fix error
        io.emit('fix-error', {
          conflictId: data.conflictId,
          error: data.error || 'Fix application failed'
        });
      }
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
          connected: connectedPlugins.size > 0,
          plugin: connectedPlugins.size > 0 ? Array.from(connectedPlugins.values())[0].plugin : plugin.plugin,
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
      socketId: p.socketId,
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

// AI Analysis (async, triggered after sync)
async function analyzeDesignSystemAsync(
  io: SocketIOServer,
  workspaceId: string,
  fileId: string,
  designSystemData: DesignSystemData
) {
  console.log('🤖 Starting AI analysis...');

  try {
    // Get workspace settings for AI configuration
    const workspace = await workspaceRepo.findById(workspaceId);
    if (!workspace) {
      console.log('⚠️ Workspace not found, skipping AI analysis');
      return;
    }

    const aiSettings = workspace.settings?.ai;
    if (!aiSettings || (!aiSettings.anthropicApiKey && !aiSettings.openaiApiKey)) {
      console.log('⚠️ AI not configured, skipping analysis');
      return;
    }

    // Initialize AI analyzer
    const analyzer = new AIAnalyzer({
      provider: aiSettings.provider || 'anthropic',
      anthropicApiKey: aiSettings.anthropicApiKey,
      openaiApiKey: aiSettings.openaiApiKey
    });

    // Broadcast analysis started
    io.to(workspaceId).emit('analysis_started', {
      fileId,
      timestamp: new Date().toISOString()
    });

    // Run analysis
    const report = await analyzer.analyzeDesignSystem(designSystemData);

    console.log(`✅ AI Analysis complete: ${report.summary.totalIssues} issues found, score: ${report.score}`);

    // Save issues as conflicts in database
    for (const issue of report.issues) {
      await pool.query(
        `INSERT INTO conflicts (
          id, workspace_id, conflict_type, severity, status,
          entity_type, entity_id, entity_name,
          description, resolution_method, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())
        ON CONFLICT DO NOTHING`,
        [
          randomUUID(),
          workspaceId,
          issue.category,
          issue.severity,
          'active',
          issue.entityType,
          issue.entityId,
          issue.entityName,
          `${issue.title}\n\n${issue.description}\n\nSuggestion: ${issue.suggestion || 'N/A'}`,
          issue.autoFixable ? 'auto' : 'manual'
        ]
      );
    }

    // Update workspace health score
    await pool.query(
      `UPDATE workspaces SET
        health_score = $1,
        last_audit = NOW(),
        updated_at = NOW()
       WHERE id = $2`,
      [report.score, workspaceId]
    );

    // Broadcast analysis complete with results
    io.to(workspaceId).emit('analysis_complete', {
      fileId,
      report: {
        summary: report.summary,
        score: report.score,
        recommendations: report.recommendations
      },
      timestamp: new Date().toISOString()
    });

    console.log(`📊 Analysis broadcast to workspace ${workspaceId}`);

    // Notify workspace members if issues were found
    if (report.summary.totalIssues > 0) {
      NotificationService.notifyWorkspaceMembers({
        workspaceId,
        type: 'conflict_detected',
        title: `${report.summary.totalIssues} issues detected in design system`,
        message: `Health score: ${report.score}/100. Review conflicts to resolve.`,
      }).catch(err => console.error('Failed to create conflict notification:', err));
    }

  } catch (error) {
    console.error('❌ AI analysis error:', error);

    // Broadcast analysis failed
    io.to(workspaceId).emit('analysis_failed', {
      fileId,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    });
  }
}
