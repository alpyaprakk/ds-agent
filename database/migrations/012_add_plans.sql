-- Plans table: defines available subscription tiers
CREATE TABLE IF NOT EXISTS plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(50) NOT NULL UNIQUE,
  display_name VARCHAR(100) NOT NULL,
  workspace_limit INT NOT NULL DEFAULT 1,       -- -1 = unlimited
  seat_limit INT NOT NULL DEFAULT 3,
  variable_limit INT NOT NULL DEFAULT 500,
  component_limit INT NOT NULL DEFAULT 100,
  ai_messages_per_month INT NOT NULL DEFAULT 50,
  price_monthly_usd NUMERIC(10,2) NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed default plans
INSERT INTO plans (name, display_name, workspace_limit, seat_limit, variable_limit, component_limit, ai_messages_per_month, price_monthly_usd)
VALUES
  ('free',       'Free',       1,   3,    500,   100,   50,   0.00),
  ('pro',        'Pro',        10,  25,   10000, 1000,  500,  29.00),
  ('enterprise', 'Enterprise', -1,  -1,   -1,    -1,    -1,   99.00)
ON CONFLICT (name) DO NOTHING;

-- User-plan assignments (one per user)
CREATE TABLE IF NOT EXISTS user_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  plan_id UUID NOT NULL REFERENCES plans(id),
  status VARCHAR(20) NOT NULL DEFAULT 'active',
  valid_until TIMESTAMPTZ,
  stripe_subscription_id VARCHAR(255),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id)
);

-- Assign free plan to all existing users who don't have one
INSERT INTO user_plans (user_id, plan_id)
SELECT u.id, p.id
FROM users u
CROSS JOIN plans p
WHERE p.name = 'free'
  AND NOT EXISTS (SELECT 1 FROM user_plans up WHERE up.user_id = u.id)
ON CONFLICT (user_id) DO NOTHING;
