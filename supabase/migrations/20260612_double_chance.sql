-- Allow double-chance prediction types: home_or_draw, away_or_draw
ALTER TABLE predictions DROP CONSTRAINT IF EXISTS predictions_predicted_result_check;
ALTER TABLE predictions ADD CONSTRAINT predictions_predicted_result_check
  CHECK (predicted_result IN ('home', 'draw', 'away', 'home_or_draw', 'away_or_draw'));
