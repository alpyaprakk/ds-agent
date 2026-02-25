import { query } from '../connection';
import { FigmaFile } from '../types';

export class FigmaFileRepository {
  async findAll(workspaceId: string): Promise<FigmaFile[]> {
    const result = await query(
      'SELECT * FROM figma_files WHERE workspace_id = $1 ORDER BY added_at DESC',
      [workspaceId]
    );
    return result.rows;
  }

  async findById(id: string): Promise<FigmaFile | null> {
    const result = await query('SELECT * FROM figma_files WHERE id = $1', [id]);
    return result.rows[0] || null;
  }

  async findByFigmaKey(figmaKey: string): Promise<FigmaFile | null> {
    const result = await query('SELECT * FROM figma_files WHERE figma_key = $1', [figmaKey]);
    return result.rows[0] || null;
  }

  async create(file: Partial<FigmaFile>): Promise<FigmaFile> {
    const url = file.url || (file.figma_key ? `https://www.figma.com/design/${file.figma_key}` : null);
    const result = await query(
      `INSERT INTO figma_files (workspace_id, figma_key, name, url, role, type, config)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (workspace_id, figma_key) DO UPDATE SET
         name = COALESCE(EXCLUDED.name, figma_files.name),
         role = COALESCE(EXCLUDED.role, figma_files.role),
         url = COALESCE(EXCLUDED.url, figma_files.url),
         updated_at = NOW()
       RETURNING *`,
      [
        file.workspace_id,
        file.figma_key,
        file.name,
        url,
        file.role || 'primary',
        file.type || 'design_system',
        JSON.stringify(file.config || {})
      ]
    );
    return result.rows[0];
  }

  async update(id: string, file: Partial<FigmaFile>): Promise<FigmaFile | null> {
    const fields: string[] = [];
    const values: any[] = [];
    let paramCount = 1;

    if (file.name !== undefined) {
      fields.push(`name = $${paramCount++}`);
      values.push(file.name);
    }
    if (file.role !== undefined) {
      fields.push(`role = $${paramCount++}`);
      values.push(file.role);
    }
    if (file.sync_status !== undefined) {
      fields.push(`sync_status = $${paramCount++}`);
      values.push(file.sync_status);
    }
    if (file.sync_error !== undefined) {
      fields.push(`sync_error = $${paramCount++}`);
      values.push(file.sync_error);
    }
    if (file.last_synced !== undefined) {
      fields.push(`last_synced = $${paramCount++}`);
      values.push(file.last_synced);
    }
    if (file.stats !== undefined) {
      fields.push(`stats = $${paramCount++}`);
      values.push(JSON.stringify(file.stats));
    }

    if (fields.length === 0) return this.findById(id);

    values.push(id);
    const result = await query(
      `UPDATE figma_files SET ${fields.join(', ')}, updated_at = NOW()
       WHERE id = $${paramCount}
       RETURNING *`,
      values
    );

    return result.rows[0] || null;
  }

  async delete(id: string): Promise<boolean> {
    const result = await query('DELETE FROM figma_files WHERE id = $1', [id]);
    return (result.rowCount || 0) > 0;
  }

  async updateSyncStatus(id: string, status: string, error?: string): Promise<void> {
    await query(
      `UPDATE figma_files
       SET sync_status = $1, sync_error = $2, last_synced = NOW(), updated_at = NOW()
       WHERE id = $3`,
      [status, error || null, id]
    );
  }
}
