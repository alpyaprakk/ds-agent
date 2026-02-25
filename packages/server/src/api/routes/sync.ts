import { Router } from 'express';
import { randomUUID } from 'crypto';
import { FigmaFileRepository } from '../../db/repositories';
import { SyncOrchestrator } from '../../sync/orchestrator';
import { figmaApi } from '../../services/figma-api';
import pool from '../../db/connection';
import { getConnectedPluginsStatus, getIO } from '../../websocket/handlers';

const router = Router();
const figmaFileRepo = new FigmaFileRepository();
const syncOrchestrator = new SyncOrchestrator();

// POST /api/sync/figma - Receive changes from Figma plugin
router.post('/figma', async (req, res) => {
  try {
    const { workspace_id, file_id, changes, timestamp } = req.body;

    if (!workspace_id || !file_id || !changes) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Process changes through sync orchestrator
    const result = await syncOrchestrator.processFigmaChanges({
      workspace_id,
      file_id,
      changes,
      timestamp: timestamp || new Date().toISOString()
    });

    return res.json(result);
  } catch (error) {
    console.error('Error processing Figma sync:', error);
    return res.status(500).json({ error: 'Failed to process sync' });
  }
});

// POST /api/sync/files/:fileId - Manual sync trigger
router.post('/files/:fileId', async (req, res) => {
  try {
    const file = await figmaFileRepo.findById(req.params.fileId);

    if (!file) {
      return res.status(404).json({ error: 'File not found' });
    }

    // Check if plugin is connected - prefer plugin-based sync
    const pluginStatus = getConnectedPluginsStatus();

    if (pluginStatus.count > 0) {
      // Trigger sync via connected plugin (no Figma API token needed)
      console.log(`🔄 Triggering sync via plugin for: ${file.name} (${file.figma_key})`);
      await figmaFileRepo.updateSyncStatus(file.id, 'syncing');

      // Send sync request to the first connected plugin (include file info for matching)
      const ioInstance = getIO();
      const pluginSocketId = pluginStatus.plugins[0]?.socketId;
      const syncRequestData = { fileId: file.id, figmaKey: file.figma_key, fileName: file.name };
      if (ioInstance && pluginSocketId) {
        ioInstance.to(pluginSocketId).emit('sync-request', syncRequestData);
      } else if (ioInstance) {
        // Broadcast to all - fallback
        ioInstance.emit('sync-request', syncRequestData);
      }

      // Safety timeout: if sync doesn't complete in 60s, reset status
      setTimeout(async () => {
        try {
          const currentFile = await figmaFileRepo.findById(file.id);
          if (currentFile && currentFile.sync_status === 'syncing') {
            console.log(`⚠️ Sync timeout for file ${file.name}, resetting status to pending`);
            await figmaFileRepo.updateSyncStatus(file.id, 'pending');
          }
        } catch (err) {
          console.error('Failed to check sync timeout:', err);
        }
      }, 60000);

      return res.json({
        success: true,
        message: 'Sync triggered via Figma plugin. Data will be synced momentarily.',
        method: 'plugin'
      });
    }

    // Fallback: Try Figma REST API (requires FIGMA_ACCESS_TOKEN)
    if (!process.env.FIGMA_ACCESS_TOKEN) {
      return res.status(400).json({
        error: 'No Figma plugin connected and FIGMA_ACCESS_TOKEN not configured.',
        message: 'Please open the Figma plugin and connect it, or set FIGMA_ACCESS_TOKEN in server environment.'
      });
    }

    // Update sync status to syncing
    await figmaFileRepo.updateSyncStatus(file.id, 'syncing');

    try {
      // Fetch data from Figma API
      console.log(`🔄 Syncing Figma file via API: ${file.name} (${file.figma_key})`);
      const syncData = await figmaApi.syncFile(file.figma_key);

      console.log(`✅ Fetched ${syncData.variables.length} variables, ${syncData.collections.length} collections, ${syncData.components.length} components`);

      // Build variable ID → name lookup for resolving aliases in valuesByMode
      const varIdToName = new Map<string, string>();
      for (const v of syncData.variables) {
        varIdToName.set(v.id, v.name);
      }
      for (const v of syncData.variables) {
        if (v.valuesByMode && typeof v.valuesByMode === 'object') {
          for (const modeKey of Object.keys(v.valuesByMode)) {
            const modeVal = (v.valuesByMode as any)[modeKey];
            if (modeVal && typeof modeVal === 'object' && modeVal.type === 'VARIABLE_ALIAS' && modeVal.id) {
              modeVal.name = varIdToName.get(modeVal.id) || modeVal.id;
            }
          }
        }
      }

      // Build variable sort_order from collection variableIds arrays (Figma ordering)
      const variableSortOrderMap = new Map<string, number>();
      for (const c of syncData.collections) {
        if (Array.isArray(c.variableIds)) {
          c.variableIds.forEach((vid, idx) => {
            variableSortOrderMap.set(vid, idx);
          });
        }
      }

      // Save variable collections (with sort_order preserving Figma order)
      for (let ci = 0; ci < syncData.collections.length; ci++) {
        const collection = syncData.collections[ci];
        await pool.query(
          `INSERT INTO variable_collections (id, workspace_id, figma_file_id, name, figma_key, figma_id, modes, sort_order)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
           ON CONFLICT (workspace_id, figma_key) DO UPDATE SET
             name = EXCLUDED.name,
             figma_id = EXCLUDED.figma_id,
             modes = EXCLUDED.modes,
             sort_order = EXCLUDED.sort_order,
             updated_at = NOW()`,
          [
            randomUUID(),
            file.workspace_id,
            file.id,
            collection.name,
            collection.key,
            collection.id,
            JSON.stringify(collection.modes),
            ci
          ]
        );
      }

      // Save variables (with sort_order preserving Figma order)
      for (const variable of syncData.variables) {
        const sortOrder = variableSortOrderMap.get(variable.id) ?? variableSortOrderMap.get(`VariableID:${variable.id}`) ?? 0;
        await pool.query(
          `INSERT INTO variables (id, workspace_id, figma_file_id, name, figma_key, figma_id, type, value, collection_id, scopes, sort_order)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
           ON CONFLICT (workspace_id, figma_key) DO UPDATE SET
             name = EXCLUDED.name,
             figma_id = EXCLUDED.figma_id,
             type = EXCLUDED.type,
             value = EXCLUDED.value,
             sort_order = EXCLUDED.sort_order,
             updated_at = NOW()`,
          [
            randomUUID(),
            file.workspace_id,
            file.id,
            variable.name,
            variable.key,
            variable.id,
            variable.resolvedType,
            JSON.stringify(variable.valuesByMode),
            variable.variableCollectionId,
            JSON.stringify([]),
            sortOrder
          ]
        );
      }

      // Save components
      for (const component of syncData.components) {
        await pool.query(
          `INSERT INTO components (id, workspace_id, figma_file_id, name, figma_key, description, type, properties)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
           ON CONFLICT (workspace_id, figma_key) DO UPDATE SET
             name = EXCLUDED.name,
             description = EXCLUDED.description,
             updated_at = NOW()`,
          [
            randomUUID(),
            file.workspace_id,
            file.id,
            component.name,
            component.key,
            component.description || '',
            'component',
            JSON.stringify({ componentSetId: component.componentSetId })
          ]
        );
      }

      // Update sync status to success
      await figmaFileRepo.updateSyncStatus(file.id, 'success');
      await pool.query(
        `UPDATE figma_files SET last_synced = NOW() WHERE id = $1`,
        [file.id]
      );

      return res.json({
        success: true,
        message: `Synced ${syncData.variables.length} variables and ${syncData.components.length} components`,
        method: 'api',
        data: {
          variables: syncData.variables.length,
          collections: syncData.collections.length,
          components: syncData.components.length
        }
      });
    } catch (syncError) {
      console.error('Figma sync error:', syncError);
      // Update sync status to failed
      await figmaFileRepo.updateSyncStatus(file.id, 'failed');
      throw syncError;
    }
  } catch (error) {
    console.error('Error triggering sync:', error);
    return res.status(500).json({
      error: 'Failed to trigger sync',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;
