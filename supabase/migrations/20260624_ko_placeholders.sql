ALTER TABLE matches
  ADD COLUMN IF NOT EXISTS home_placeholder text,
  ADD COLUMN IF NOT EXISTS away_placeholder text;
