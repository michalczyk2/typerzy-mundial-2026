-- 2026-07-01: add ko_winner_pick to bonus_points.bonus_type CHECK constraint
-- Idempotent — bezpieczne do wielokrotnego uruchomienia

ALTER TABLE bonus_points DROP CONSTRAINT IF EXISTS bonus_points_bonus_type_check;
ALTER TABLE bonus_points ADD CONSTRAINT bonus_points_bonus_type_check
  CHECK (bonus_type IN ('round_king','streak_3','streak_5','risky_pick','tournament_winner','perfect_round','ko_winner_pick'));
