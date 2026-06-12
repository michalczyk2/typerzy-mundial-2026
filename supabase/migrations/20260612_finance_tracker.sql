-- Finance module: private betting tracker
-- All tables are private per user — no public RLS policies
-- All reads/writes go through API routes using service role client

CREATE TABLE IF NOT EXISTS betting_settings (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                 UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE UNIQUE,
  starting_balance        NUMERIC(12,2) NOT NULL DEFAULT 0,
  manual_current_balance  NUMERIC(12,2),
  monthly_loss_limit      NUMERIC(12,2),
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS betting_transactions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  type        TEXT NOT NULL CHECK (type IN ('deposit','withdrawal')),
  amount      NUMERIC(12,2) NOT NULL,
  date        DATE NOT NULL,
  note        TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS betting_bets (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  date            DATE NOT NULL,
  sport           TEXT NOT NULL DEFAULT '',
  league          TEXT NOT NULL DEFAULT '',
  event_name      TEXT NOT NULL DEFAULT '',
  bet_type        TEXT NOT NULL DEFAULT '',
  bookmaker       TEXT NOT NULL DEFAULT '',
  stake           NUMERIC(12,2) NOT NULL,
  odds            NUMERIC(10,4) NOT NULL,
  status          TEXT NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending','won','lost','cashout','void')),
  cash_out_amount NUMERIC(12,2),
  payout          NUMERIC(12,2) NOT NULL DEFAULT 0,
  profit          NUMERIC(12,2) NOT NULL DEFAULT 0,
  note            TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- RLS enabled — no public policies (service role only, via API routes)
ALTER TABLE betting_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE betting_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE betting_bets ENABLE ROW LEVEL SECURITY;

-- updated_at auto-triggers (reuse existing update_updated_at() function from schema.sql)
CREATE TRIGGER betting_settings_updated_at
  BEFORE UPDATE ON betting_settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER betting_bets_updated_at
  BEFORE UPDATE ON betting_bets
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
