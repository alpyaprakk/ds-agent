import { query } from '../connection';
import { Workspace } from '../types';

export class WorkspaceRepository {
  async findAll(): Promise<Workspace[]> {
    const result = await query('SELECT * FROM workspaces ORDER BY created_at DESC');
    return result.rows;
  }

  async findById(id: string): Promise<Workspace | null> {
    const result = await query('SELECT * FROM workspaces WHERE id = $1', [id]);
    return result.rows[0] || null;
  }

  async create(workspace: Partial<Workspace>): Promise<Workspace> {
    const result = await query(
      `INSERT INTO workspaces (name, description, icon, color, team_name, settings)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [
        workspace.name,
        workspace.description,
        workspace.icon || '📦',
        workspace.color || '#3B82F6',
        workspace.team_name,
        JSON.stringify(workspace.settings || {})
      ]
    );
    return result.rows[0];
  }

  async update(id: string, workspace: Partial<Workspace>): Promise<Workspace | null> {
    const fields: string[] = [];
    const values: any[] = [];
    let paramCount = 1;

    if (workspace.name !== undefined) {
      fields.push(`name = $${paramCount++}`);
      values.push(workspace.name);
    }
    if (workspace.description !== undefined) {
      fields.push(`description = $${paramCount++}`);
      values.push(workspace.description);
    }
    if (workspace.icon !== undefined) {
      fields.push(`icon = $${paramCount++}`);
      values.push(workspace.icon);
    }
    if (workspace.color !== undefined) {
      fields.push(`color = $${paramCount++}`);
      values.push(workspace.color);
    }
    if (workspace.settings !== undefined) {
      fields.push(`settings = $${paramCount++}`);
      values.push(JSON.stringify(workspace.settings));
    }
    if (workspace.health_score !== undefined) {
      fields.push(`health_score = $${paramCount++}`);
      values.push(workspace.health_score);
    }

    if (fields.length === 0) return this.findById(id);

    values.push(id);
    const result = await query(
      `UPDATE workspaces SET ${fields.join(', ')}, updated_at = NOW()
       WHERE id = $${paramCount}
       RETURNING *`,
      values
    );

    return result.rows[0] || null;
  }

  async delete(id: string): Promise<boolean> {
    const result = await query('DELETE FROM workspaces WHERE id = $1', [id]);
    return (result.rowCount || 0) > 0;
  }

  async getHealth(id: string): Promise<any> {
    const result = await query(
      `SELECT * FROM workspace_health WHERE id = $1`,
      [id]
    );
    return result.rows[0] || null;
  }
}
