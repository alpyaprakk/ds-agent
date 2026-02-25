import { query } from '../connection';

export interface Plan {
  id: string;
  name: string;
  display_name: string;
  workspace_limit: number;
  seat_limit: number;
  variable_limit: number;
  component_limit: number;
  ai_messages_per_month: number;
  price_monthly_usd: number;
  is_active: boolean;
  created_at: Date;
}

export interface UserPlan {
  id: string;
  user_id: string;
  plan_id: string;
  plan_name: string;
  display_name: string;
  workspace_limit: number;
  seat_limit: number;
  variable_limit: number;
  component_limit: number;
  ai_messages_per_month: number;
  status: string;
  valid_until: Date | null;
  stripe_subscription_id: string | null;
}

export class PlanRepository {
  // Get user's active plan (defaults to free if none assigned)
  static async getUserPlan(userId: string): Promise<UserPlan> {
    const result = await query(
      `SELECT up.*, p.name as plan_name, p.display_name, p.workspace_limit, p.seat_limit,
              p.variable_limit, p.component_limit, p.ai_messages_per_month
       FROM user_plans up
       JOIN plans p ON p.id = up.plan_id
       WHERE up.user_id = $1 AND up.status = 'active'`,
      [userId]
    );

    if (result.rows[0]) return result.rows[0];

    // No plan found — return free plan defaults
    const freePlan = await query(`SELECT * FROM plans WHERE name = 'free' LIMIT 1`);
    const fp = freePlan.rows[0];
    return {
      id: '',
      user_id: userId,
      plan_id: fp?.id || '',
      plan_name: 'free',
      display_name: 'Free',
      workspace_limit: fp?.workspace_limit ?? 1,
      seat_limit: fp?.seat_limit ?? 3,
      variable_limit: fp?.variable_limit ?? 500,
      component_limit: fp?.component_limit ?? 100,
      ai_messages_per_month: fp?.ai_messages_per_month ?? 50,
      status: 'active',
      valid_until: null,
      stripe_subscription_id: null,
    };
  }

  // Assign a named plan to a user (upsert)
  static async setUserPlan(userId: string, planName: string): Promise<void> {
    const planResult = await query(`SELECT id FROM plans WHERE name = $1`, [planName]);
    if (!planResult.rows[0]) throw new Error(`Plan not found: ${planName}`);
    const planId = planResult.rows[0].id;

    await query(
      `INSERT INTO user_plans (user_id, plan_id, status)
       VALUES ($1, $2, 'active')
       ON CONFLICT (user_id) DO UPDATE SET
         plan_id = EXCLUDED.plan_id,
         status = 'active',
         updated_at = NOW()`,
      [userId, planId]
    );
  }

  // Assign free plan to a new user (called on register)
  static async assignFreePlan(userId: string): Promise<void> {
    await query(
      `INSERT INTO user_plans (user_id, plan_id)
       SELECT $1, id FROM plans WHERE name = 'free'
       ON CONFLICT (user_id) DO NOTHING`,
      [userId]
    );
  }

  // Check whether user is within a specific limit
  // Returns true if allowed, false if limit exceeded
  static async checkLimit(userId: string, limitType: 'workspace' | 'seat' | 'ai_message'): Promise<boolean> {
    const plan = await PlanRepository.getUserPlan(userId);

    if (limitType === 'workspace') {
      if (plan.workspace_limit === -1) return true;
      const res = await query(
        `SELECT COUNT(*) FROM workspace_members WHERE user_id = $1 AND role = 'owner'`,
        [userId]
      );
      return parseInt(res.rows[0].count) < plan.workspace_limit;
    }

    if (limitType === 'seat') {
      // seat_limit is checked per-workspace; caller passes workspace owner's userId
      return true; // Seat check done inline in invite route with workspace context
    }

    if (limitType === 'ai_message') {
      if (plan.ai_messages_per_month === -1) return true;
      const period = new Date().toISOString().slice(0, 7); // 'YYYY-MM'
      const res = await query(
        `SELECT ai_messages_used FROM usage_snapshots WHERE user_id = $1 AND period = $2`,
        [userId, period]
      );
      const used = parseInt(res.rows[0]?.ai_messages_used || '0');
      return used < plan.ai_messages_per_month;
    }

    return true;
  }

  // Check seat limit for a specific workspace (pass workspace owner's user_id for plan)
  static async checkSeatLimit(workspaceId: string): Promise<boolean> {
    // Get workspace owner
    const ownerRes = await query(
      `SELECT user_id FROM workspace_members WHERE workspace_id = $1 AND role = 'owner' LIMIT 1`,
      [workspaceId]
    );
    if (!ownerRes.rows[0]) return true;

    const ownerId = ownerRes.rows[0].user_id;
    const plan = await PlanRepository.getUserPlan(ownerId);
    if (plan.seat_limit === -1) return true;

    const countRes = await query(
      `SELECT COUNT(*) FROM workspace_members WHERE workspace_id = $1`,
      [workspaceId]
    );
    return parseInt(countRes.rows[0].count) < plan.seat_limit;
  }

  // Increment AI message usage for current month
  static async incrementAiUsage(userId: string): Promise<void> {
    const period = new Date().toISOString().slice(0, 7);
    await query(
      `INSERT INTO usage_snapshots (user_id, period, ai_messages_used)
       VALUES ($1, $2, 1)
       ON CONFLICT (user_id, period) DO UPDATE SET
         ai_messages_used = usage_snapshots.ai_messages_used + 1,
         updated_at = NOW()`,
      [userId, period]
    );
  }

  static async getAllPlans(): Promise<Plan[]> {
    const result = await query(`SELECT * FROM plans ORDER BY price_monthly_usd ASC`);
    return result.rows;
  }

  static async updatePlan(id: string, data: Partial<Plan>): Promise<Plan> {
    const fields: string[] = [];
    const values: any[] = [];
    let i = 1;

    const allowed = ['display_name', 'workspace_limit', 'seat_limit', 'variable_limit',
      'component_limit', 'ai_messages_per_month', 'price_monthly_usd', 'is_active'];
    for (const key of allowed) {
      if ((data as any)[key] !== undefined) {
        fields.push(`${key} = $${i++}`);
        values.push((data as any)[key]);
      }
    }
    if (fields.length === 0) throw new Error('No fields to update');
    values.push(id);

    const result = await query(
      `UPDATE plans SET ${fields.join(', ')} WHERE id = $${i} RETURNING *`,
      values
    );
    return result.rows[0];
  }
}
