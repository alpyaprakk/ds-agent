import { Router } from 'express';
import { WorkspaceRepository, FigmaFileRepository, UserRepository } from '../../db/repositories';
import { authMiddleware, AuthRequest } from '../../middleware/auth';
import { NotificationService } from '../../services/notification.service';
import { PlanRepository } from '../../db/repositories/plan.repository';
import pool from '../../db/connection';
import { consoleLogger } from '../../services/console-logger.service';

const router = Router();
const workspaceRepo = new WorkspaceRepository();
const figmaFileRepo = new FigmaFileRepository();

// Apply auth middleware to all workspace routes
router.use(authMiddleware);

// ==========================================
// Workspace CRUD
// ==========================================

// GET /api/workspaces - List user's workspaces
router.get('/', async (req: AuthRequest, res) => {
  try {
    const workspaces = await UserRepository.getWorkspacesByUser(req.user!.id);
    return res.json({ workspaces });
  } catch (error) {
    console.error('Error fetching workspaces:', error);
    return res.status(500).json({ error: 'Failed to fetch workspaces' });
  }
});

// GET /api/workspaces/:id - Get workspace by ID
router.get('/:id', async (req: AuthRequest, res) => {
  try {
    const isMember = await UserRepository.isWorkspaceMember(req.user!.id, req.params.id);
    if (!isMember) {
      return res.status(403).json({ error: 'Access denied' });
    }
    const workspace = await workspaceRepo.findById(req.params.id);
    if (!workspace) {
      return res.status(404).json({ error: 'Workspace not found' });
    }
    return res.json({ workspace });
  } catch (error) {
    console.error('Error fetching workspace:', error);
    return res.status(500).json({ error: 'Failed to fetch workspace' });
  }
});

// POST /api/workspaces - Create new workspace
router.post('/', async (req: AuthRequest, res) => {
  try {
    const allowed = await PlanRepository.checkLimit(req.user!.id, 'workspace');
    if (!allowed) {
      return res.status(403).json({ error: 'plan_limit_exceeded', limit: 'workspace' });
    }
    const workspace = await workspaceRepo.create(req.body);
    await UserRepository.addToWorkspace(req.user!.id, workspace.id, 'owner');
    return res.status(201).json({ workspace });
  } catch (error) {
    console.error('Error creating workspace:', error);
    return res.status(500).json({ error: 'Failed to create workspace' });
  }
});

// PATCH /api/workspaces/:id - Update workspace (owner/admin only)
router.patch('/:id', async (req: AuthRequest, res) => {
  try {
    const role = await UserRepository.getMemberRole(req.user!.id, req.params.id);
    if (!role || !['owner', 'admin'].includes(role)) {
      return res.status(403).json({ error: 'Only owners and admins can update workspace settings' });
    }
    const workspace = await workspaceRepo.update(req.params.id, req.body);
    if (!workspace) {
      return res.status(404).json({ error: 'Workspace not found' });
    }
    return res.json({ workspace });
  } catch (error) {
    console.error('Error updating workspace:', error);
    return res.status(500).json({ error: 'Failed to update workspace' });
  }
});

// POST /api/workspaces/:id/reset - Reset workspace data (owner only)
// Deletes all tokens, collections, components, files, conflicts, and logs
// Keeps workspace, members, and settings intact
router.post('/:id/reset', async (req: AuthRequest, res) => {
  try {
    const role = await UserRepository.getMemberRole(req.user!.id, req.params.id);
    if (role !== 'owner') {
      return res.status(403).json({ error: 'Only the workspace owner can reset it' });
    }

    const workspace = await workspaceRepo.findById(req.params.id);
    if (!workspace) {
      return res.status(404).json({ error: 'Workspace not found' });
    }

    // Delete all workspace data in transaction
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Delete in order to respect foreign key constraints
      await client.query('DELETE FROM conflicts WHERE workspace_id = $1', [req.params.id]);
      await client.query('DELETE FROM change_logs WHERE workspace_id = $1', [req.params.id]);
      await client.query('DELETE FROM sync_history WHERE workspace_id = $1', [req.params.id]);
      await client.query('DELETE FROM components WHERE workspace_id = $1', [req.params.id]);
      await client.query('DELETE FROM variables WHERE workspace_id = $1', [req.params.id]);
      await client.query('DELETE FROM variable_collections WHERE workspace_id = $1', [req.params.id]);
      await client.query('DELETE FROM figma_files WHERE workspace_id = $1', [req.params.id]);

      // Clear console logs (in-memory)
      consoleLogger.clearLogs(req.params.id);

      await client.query('COMMIT');

      // Notify workspace members about reset
      NotificationService.notifyWorkspaceMembers({
        workspaceId: req.params.id,
        type: 'workspace_reset',
        title: `${workspace.name} was reset`,
        message: `${req.user!.name} reset all data in the workspace. Members and settings are preserved.`,
        actorId: req.user!.id,
        excludeUserId: req.user!.id,
      }).catch(err => console.error('Failed to create reset notification:', err));

      return res.json({
        success: true,
        message: 'Workspace data reset successfully. All tokens, components, and files have been deleted.'
      });
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Error resetting workspace:', error);
    return res.status(500).json({ error: 'Failed to reset workspace' });
  }
});

// DELETE /api/workspaces/:id - Delete workspace (owner only)
router.delete('/:id', async (req: AuthRequest, res) => {
  try {
    const role = await UserRepository.getMemberRole(req.user!.id, req.params.id);
    if (role !== 'owner') {
      return res.status(403).json({ error: 'Only the workspace owner can delete it' });
    }
    const deleted = await workspaceRepo.delete(req.params.id);
    if (!deleted) {
      return res.status(404).json({ error: 'Workspace not found' });
    }

    // Notify workspace members before deletion (they will be removed)
    const workspace = await workspaceRepo.findById(req.params.id);
    if (workspace) {
      NotificationService.notifyWorkspaceMembers({
        workspaceId: req.params.id,
        type: 'workspace_deleted',
        title: `${workspace.name} was deleted`,
        message: `${req.user!.name} deleted the workspace`,
        actorId: req.user!.id,
        excludeUserId: req.user!.id,
      }).catch(err => console.error('Failed to create deletion notification:', err));
    }

    return res.json({ success: true });
  } catch (error) {
    console.error('Error deleting workspace:', error);
    return res.status(500).json({ error: 'Failed to delete workspace' });
  }
});

// GET /api/workspaces/:id/health - Get workspace health
router.get('/:id/health', async (req: AuthRequest, res) => {
  try {
    const isMember = await UserRepository.isWorkspaceMember(req.user!.id, req.params.id);
    if (!isMember) return res.status(403).json({ error: 'Access denied' });

    const health = await workspaceRepo.getHealth(req.params.id);
    if (!health) {
      return res.status(404).json({ error: 'Workspace not found' });
    }
    return res.json({ health });
  } catch (error) {
    console.error('Error fetching workspace health:', error);
    return res.status(500).json({ error: 'Failed to fetch workspace health' });
  }
});

// ==========================================
// Figma Files
// ==========================================

// GET /api/workspaces/:id/files
router.get('/:id/files', async (req: AuthRequest, res) => {
  try {
    const isMember = await UserRepository.isWorkspaceMember(req.user!.id, req.params.id);
    if (!isMember) return res.status(403).json({ error: 'Access denied' });

    const files = await figmaFileRepo.findAll(req.params.id);
    return res.json({ files });
  } catch (error) {
    console.error('Error fetching Figma files:', error);
    return res.status(500).json({ error: 'Failed to fetch Figma files' });
  }
});

// POST /api/workspaces/:id/files (upsert)
router.post('/:id/files', async (req: AuthRequest, res) => {
  try {
    const isMember = await UserRepository.isWorkspaceMember(req.user!.id, req.params.id);
    if (!isMember) return res.status(403).json({ error: 'Access denied' });

    const file = await figmaFileRepo.create({
      ...req.body,
      workspace_id: req.params.id
    });

    // Notify workspace members about new file
    NotificationService.notifyWorkspaceMembers({
      workspaceId: req.params.id,
      type: 'figma_file_added',
      title: `New Figma file added: ${file.name || 'Untitled'}`,
      message: `${req.user!.name} added a new Figma file`,
      actorId: req.user!.id,
      referenceType: 'figma_file',
      referenceId: file.id,
      excludeUserId: req.user!.id,
    }).catch(err => console.error('Failed to create file added notification:', err));

    return res.status(201).json({ file });
  } catch (error) {
    console.error('Error adding Figma file:', error);
    return res.status(500).json({ error: 'Failed to add Figma file' });
  }
});

// DELETE /api/workspaces/:workspaceId/files/:fileId
router.delete('/:workspaceId/files/:fileId', async (req: AuthRequest, res) => {
  try {
    const role = await UserRepository.getMemberRole(req.user!.id, req.params.workspaceId);
    if (!role || !['owner', 'admin'].includes(role)) {
      return res.status(403).json({ error: 'Only owners and admins can remove files' });
    }
    // Get file info before deletion for notification
    const fileResult = await pool.query('SELECT name FROM figma_files WHERE id = $1', [req.params.fileId]);
    const fileName = fileResult.rows[0]?.name;

    // Dismiss all active conflicts whose entity belongs to this file.
    // AI analyzer writes figma_id (e.g. "VariableID:123:456") into entity_id.
    // We also check figma_key as fallback for conflicts created by other sources.
    await pool.query(
      `UPDATE conflicts
       SET status = 'dismissed', updated_at = NOW()
       WHERE workspace_id = $1
         AND status = 'active'
         AND entity_id IN (
           SELECT figma_id FROM variables WHERE figma_file_id = $2 AND figma_id IS NOT NULL
           UNION ALL
           SELECT figma_key FROM variables WHERE figma_file_id = $2 AND figma_key IS NOT NULL
           UNION ALL
           SELECT figma_id FROM components WHERE figma_file_id = $2 AND figma_id IS NOT NULL
           UNION ALL
           SELECT figma_key FROM components WHERE figma_file_id = $2 AND figma_key IS NOT NULL
         )`,
      [req.params.workspaceId, req.params.fileId]
    );

    const deleted = await figmaFileRepo.delete(req.params.fileId);
    if (!deleted) {
      return res.status(404).json({ error: 'File not found' });
    }

    // Notify workspace members
    if (fileName) {
      NotificationService.notifyWorkspaceMembers({
        workspaceId: req.params.workspaceId,
        type: 'figma_file_removed',
        title: `Figma file removed: ${fileName}`,
        message: `${req.user!.name} removed the file from the workspace`,
        actorId: req.user!.id,
        excludeUserId: req.user!.id,
      }).catch(err => console.error('Failed to create file removed notification:', err));
    }

    return res.json({ success: true });
  } catch (error) {
    console.error('Error deleting Figma file:', error);
    return res.status(500).json({ error: 'Failed to delete Figma file' });
  }
});

// ==========================================
// Settings
// ==========================================

// GET /api/workspaces/:id/settings
router.get('/:id/settings', async (req: AuthRequest, res) => {
  try {
    const isMember = await UserRepository.isWorkspaceMember(req.user!.id, req.params.id);
    if (!isMember) return res.status(403).json({ error: 'Access denied' });

    const workspace = await workspaceRepo.findById(req.params.id);
    if (!workspace) {
      return res.status(404).json({ error: 'Workspace not found' });
    }
    return res.json(workspace.settings || {});
  } catch (error) {
    console.error('Error fetching workspace settings:', error);
    return res.status(500).json({ error: 'Failed to fetch workspace settings' });
  }
});

// PUT /api/workspaces/:id/settings
router.put('/:id/settings', async (req: AuthRequest, res) => {
  try {
    const role = await UserRepository.getMemberRole(req.user!.id, req.params.id);
    if (!role || !['owner', 'admin'].includes(role)) {
      return res.status(403).json({ error: 'Only owners and admins can update settings' });
    }

    const workspace = await workspaceRepo.findById(req.params.id);
    if (!workspace) {
      return res.status(404).json({ error: 'Workspace not found' });
    }

    const updatedSettings = { ...(workspace.settings || {}), ...req.body };
    const updated = await workspaceRepo.update(req.params.id, { settings: updatedSettings });
    return res.json(updated?.settings || {});
  } catch (error) {
    console.error('Error updating workspace settings:', error);
    return res.status(500).json({ error: 'Failed to update workspace settings' });
  }
});

// ==========================================
// Members
// ==========================================

// GET /api/workspaces/:id/members
router.get('/:id/members', async (req: AuthRequest, res) => {
  try {
    const isMember = await UserRepository.isWorkspaceMember(req.user!.id, req.params.id);
    if (!isMember) return res.status(403).json({ error: 'Access denied' });

    const members = await UserRepository.getWorkspaceMembers(req.params.id);
    return res.json({ members });
  } catch (error) {
    console.error('Error fetching members:', error);
    return res.status(500).json({ error: 'Failed to fetch members' });
  }
});

// POST /api/workspaces/:id/members/invite
router.post('/:id/members/invite', async (req: AuthRequest, res) => {
  try {
    const role = await UserRepository.getMemberRole(req.user!.id, req.params.id);
    if (!role || !['owner', 'admin'].includes(role)) {
      return res.status(403).json({ error: 'Only owners and admins can invite members' });
    }

    const { email, role: inviteRole } = req.body;
    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    const validRoles = ['admin', 'member'];
    const targetRole = validRoles.includes(inviteRole) ? inviteRole : 'member';

    if (targetRole === 'admin' && role !== 'owner') {
      return res.status(403).json({ error: 'Only owners can invite admins' });
    }

    const seatAllowed = await PlanRepository.checkSeatLimit(req.params.id);
    if (!seatAllowed) {
      return res.status(403).json({ error: 'plan_limit_exceeded', limit: 'seat' });
    }

    // Check if already a member
    const existingUser = await UserRepository.findByEmail(email.toLowerCase());
    if (existingUser) {
      const alreadyMember = await UserRepository.isWorkspaceMember(existingUser.id, req.params.id);
      if (alreadyMember) {
        return res.status(409).json({ error: 'User is already a workspace member' });
      }
    }

    const invitation = await UserRepository.createInvitation(
      req.params.id, email, targetRole, req.user!.id
    );

    // Notify invited user if they have an account
    if (existingUser) {
      const workspace = await workspaceRepo.findById(req.params.id);
      NotificationService.notify({
        userId: existingUser.id,
        workspaceId: req.params.id,
        type: 'workspace_invitation',
        title: `You've been invited to ${workspace?.name || 'a workspace'}`,
        message: `${req.user!.name} invited you as ${targetRole}`,
        actorId: req.user!.id,
        referenceType: 'invitation',
        referenceId: invitation.id,
      }).catch(err => console.error('Failed to create invitation notification:', err));
    }

    return res.status(201).json({ invitation });
  } catch (error) {
    console.error('Error inviting member:', error);
    return res.status(500).json({ error: 'Failed to send invitation' });
  }
});

// GET /api/workspaces/:id/members/invitations
router.get('/:id/members/invitations', async (req: AuthRequest, res) => {
  try {
    const role = await UserRepository.getMemberRole(req.user!.id, req.params.id);
    if (!role || !['owner', 'admin'].includes(role)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const invitations = await UserRepository.getWorkspaceInvitations(req.params.id);
    return res.json({ invitations });
  } catch (error) {
    console.error('Error fetching invitations:', error);
    return res.status(500).json({ error: 'Failed to fetch invitations' });
  }
});

// DELETE /api/workspaces/:id/members/invitations/:invitationId
router.delete('/:id/members/invitations/:invitationId', async (req: AuthRequest, res) => {
  try {
    const role = await UserRepository.getMemberRole(req.user!.id, req.params.id);
    if (!role || !['owner', 'admin'].includes(role)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const cancelled = await UserRepository.cancelInvitation(req.params.invitationId);
    if (!cancelled) {
      return res.status(404).json({ error: 'Invitation not found or already responded' });
    }
    return res.json({ success: true });
  } catch (error) {
    console.error('Error cancelling invitation:', error);
    return res.status(500).json({ error: 'Failed to cancel invitation' });
  }
});

// PATCH /api/workspaces/:id/members/:userId/role
router.patch('/:id/members/:userId/role', async (req: AuthRequest, res) => {
  try {
    const myRole = await UserRepository.getMemberRole(req.user!.id, req.params.id);
    if (myRole !== 'owner') {
      return res.status(403).json({ error: 'Only the workspace owner can change roles' });
    }

    if (req.params.userId === req.user!.id) {
      return res.status(400).json({ error: 'Cannot change your own role' });
    }

    const { role: newRole } = req.body;
    if (!['admin', 'member'].includes(newRole)) {
      return res.status(400).json({ error: 'Invalid role. Must be admin or member' });
    }

    await UserRepository.updateMemberRole(req.params.userId, req.params.id, newRole);

    // Notify the user whose role changed
    const workspace = await workspaceRepo.findById(req.params.id);
    NotificationService.notify({
      userId: req.params.userId,
      workspaceId: req.params.id,
      type: 'role_changed',
      title: `Your role was updated to ${newRole}`,
      message: `${req.user!.name} changed your role in ${workspace?.name || 'workspace'}`,
      actorId: req.user!.id,
    }).catch(err => console.error('Failed to create role change notification:', err));

    return res.json({ success: true });
  } catch (error) {
    console.error('Error updating member role:', error);
    return res.status(500).json({ error: 'Failed to update member role' });
  }
});

// DELETE /api/workspaces/:id/members/:userId
router.delete('/:id/members/:userId', async (req: AuthRequest, res) => {
  try {
    const myRole = await UserRepository.getMemberRole(req.user!.id, req.params.id);
    const isRemovingSelf = req.params.userId === req.user!.id;

    if (!isRemovingSelf && myRole !== 'owner') {
      return res.status(403).json({ error: 'Only the owner can remove members' });
    }

    if (isRemovingSelf && myRole === 'owner') {
      return res.status(400).json({ error: 'Workspace owner cannot leave. Transfer ownership or delete the workspace.' });
    }

    // Get workspace info before removal for notification
    const workspace = await workspaceRepo.findById(req.params.id);

    const removed = await UserRepository.removeFromWorkspace(req.params.userId, req.params.id);
    if (!removed) {
      return res.status(404).json({ error: 'Member not found' });
    }

    // Notify removed member (only if removed by someone else)
    if (!isRemovingSelf) {
      NotificationService.notify({
        userId: req.params.userId,
        workspaceId: req.params.id,
        type: 'member_removed',
        title: `You were removed from ${workspace?.name || 'a workspace'}`,
        message: `${req.user!.name} removed you from the workspace`,
        actorId: req.user!.id,
      }).catch(err => console.error('Failed to create removal notification:', err));
    }

    return res.json({ success: true });
  } catch (error) {
    console.error('Error removing member:', error);
    return res.status(500).json({ error: 'Failed to remove member' });
  }
});

// ==========================================
// Variables & Collections
// ==========================================

// GET /api/workspaces/:id/collections - Get variable collections with variable counts
router.get('/:id/collections', async (req: AuthRequest, res) => {
  try {
    const isMember = await UserRepository.isWorkspaceMember(req.user!.id, req.params.id);
    if (!isMember) return res.status(403).json({ error: 'Access denied' });

    const result = await pool.query(
      `SELECT vc.*,
              (SELECT COUNT(*) FROM variables v WHERE v.workspace_id = vc.workspace_id AND v.collection_id = vc.figma_id) as variable_count
       FROM variable_collections vc
       WHERE vc.workspace_id = $1
       ORDER BY vc.sort_order ASC, vc.name ASC`,
      [req.params.id]
    );
    return res.json({ collections: result.rows });
  } catch (error) {
    console.error('Error fetching collections:', error);
    return res.status(500).json({ error: 'Failed to fetch collections' });
  }
});

// GET /api/workspaces/:id/variables - Get all variables (with optional collection filter)
router.get('/:id/variables', async (req: AuthRequest, res) => {
  try {
    const isMember = await UserRepository.isWorkspaceMember(req.user!.id, req.params.id);
    if (!isMember) return res.status(403).json({ error: 'Access denied' });

    const collectionFigmaId = req.query.collection as string | undefined;

    let queryText = `SELECT v.*, vc.name as collection_name
       FROM variables v
       LEFT JOIN variable_collections vc ON vc.figma_id = v.collection_id AND vc.workspace_id = v.workspace_id
       WHERE v.workspace_id = $1`;
    const params: any[] = [req.params.id];

    if (collectionFigmaId) {
      queryText += ` AND v.collection_id = $2`;
      params.push(collectionFigmaId);
    }

    queryText += ` ORDER BY v.sort_order ASC, v.name ASC`;

    const result = await pool.query(queryText, params);
    return res.json({ variables: result.rows });
  } catch (error) {
    console.error('Error fetching variables:', error);
    return res.status(500).json({ error: 'Failed to fetch variables' });
  }
});

// ==========================================
// Components
// ==========================================

// GET /api/workspaces/:id/components - Get all components (with optional search)
router.get('/:id/components', async (req: AuthRequest, res) => {
  try {
    const isMember = await UserRepository.isWorkspaceMember(req.user!.id, req.params.id);
    if (!isMember) return res.status(403).json({ error: 'Access denied' });

    const search = req.query.search as string | undefined;

    let queryText = `SELECT c.*, ff.name as file_name
       FROM components c
       LEFT JOIN figma_files ff ON ff.id = c.figma_file_id
       WHERE c.workspace_id = $1`;
    const params: any[] = [req.params.id];

    if (search) {
      queryText += ` AND c.name ILIKE $2`;
      params.push(`%${search}%`);
    }

    queryText += ` ORDER BY c.name ASC`;

    const result = await pool.query(queryText, params);
    return res.json({ components: result.rows });
  } catch (error) {
    console.error('Error fetching components:', error);
    return res.status(500).json({ error: 'Failed to fetch components' });
  }
});

// ==========================================
// Console Logs (Debugging)
// ==========================================

// GET /api/workspaces/:id/console-logs - Get recent console logs for debugging
router.get('/:id/console-logs', async (req: AuthRequest, res) => {
  try {
    const isMember = await UserRepository.isWorkspaceMember(req.user!.id, req.params.id);
    if (!isMember) return res.status(403).json({ error: 'Access denied' });

    const limit = Math.min(Number(req.query.limit) || 100, 1000);
    const level = (req.query.level as string) || 'all';
    const source = (req.query.source as string) || 'all';

    const logs = consoleLogger.getLogs(req.params.id, {
      limit,
      level: level as any,
      source: source as any,
    });

    const totalCount = consoleLogger.getLogCount(req.params.id);
    const oldestTimestamp = logs.length > 0 ? logs[logs.length - 1].timestamp : undefined;
    const newestTimestamp = logs.length > 0 ? logs[0].timestamp : undefined;

    return res.json({
      logs,
      totalCount,
      oldestTimestamp,
      newestTimestamp,
    });
  } catch (error) {
    console.error('Error fetching console logs:', error);
    return res.status(500).json({ error: 'Failed to fetch console logs' });
  }
});

export default router;
