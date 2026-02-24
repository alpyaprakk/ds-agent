import { query } from '../connection';
import { Conflict } from '../types';

export class ConflictRepository {
  async findAll(workspaceId: string, status?: string): Promise<Conflict[]> {
    let sql = 'SELECT * FROM conflicts WHERE workspace_id = $1';
    const params: any[] = [workspaceId];

    if (status) {
      sql += ' AND status = $2';
      params.push(status);
    }

    sql += ' ORDER BY created_at DESC';

    const result = await query(sql, params);
    return result.rows;
  }

  async findById(id: string): Promise<Conflict | null> {
    const result = await query('SELECT * FROM conflicts WHERE id = $1', [id]);
    return result.rows[0] || null;
  }

  async create(conflict: Partial<Conflict>): Promise<Conflict> {
    const result = await query(
      `INSERT INTO conflicts (
        workspace_id, conflict_type, severity, status, entity_type, entity_id, entity_name,
        source1_type, source1_action, source1_value, source1_timestamp,
        source2_type, source2_action, source2_value, source2_timestamp,
        description, impact_score
      )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
       RETURNING *`,
      [
        conflict.workspace_id,
        conflict.conflict_type,
        conflict.severity,
        conflict.status || 'active',
        conflict.entity_type,
        conflict.entity_id,
        conflict.entity_name,
        conflict.source1_type,
        conflict.source1_action,
        JSON.stringify(conflict.source1_value),
        conflict.source1_timestamp,
        conflict.source2_type,
        conflict.source2_action,
        JSON.stringify(conflict.source2_value),
        conflict.source2_timestamp,
        conflict.description,
        conflict.impact_score || 0
      ]
    );
    return result.rows[0];
  }

  async resolve(
    id: string,
    method: string,
    chosen: string,
    value: any,
    resolvedBy: string
  ): Promise<Conflict | null> {
    const result = await query(
      `UPDATE conflicts
       SET status = 'resolved',
           resolution_method = $1,
           resolution_chosen = $2,
           resolution_value = $3,
           resolved_by = $4,
           resolved_at = NOW(),
           updated_at = NOW()
       WHERE id = $5
       RETURNING *`,
      [method, chosen, JSON.stringify(value), resolvedBy, id]
    );

    // Log to conflict history
    if (result.rows[0]) {
      await query(
        `INSERT INTO conflict_history (conflict_id, action, actor, details)
         VALUES ($1, 'resolved', $2, $3)`,
        [id, resolvedBy, JSON.stringify({ method, chosen, value })]
      );
    }

    return result.rows[0] || null;
  }

  async dismiss(id: string, actor: string): Promise<Conflict | null> {
    const result = await query(
      `UPDATE conflicts
       SET status = 'dismissed', updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [id]
    );

    if (result.rows[0]) {
      await query(
        `INSERT INTO conflict_history (conflict_id, action, actor)
         VALUES ($1, 'dismissed', $2)`,
        [id, actor]
      );
    }

    return result.rows[0] || null;
  }

  async getActiveBySeverity(workspaceId: string): Promise<any[]> {
    const result = await query(
      `SELECT * FROM active_conflicts_summary WHERE workspace_id = $1`,
      [workspaceId]
    );
    return result.rows;
  }
}
