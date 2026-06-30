-- score_a/score_b for KO matches store the post-extra-time result. "Dokładny wynik"
-- scoring must use only the 90-minute regulation score, so admin can manually record
-- it here for the few KO matches that went to extra time/penalties.
ALTER TABLE matches
  ADD COLUMN IF NOT EXISTS score_a_90 integer,
  ADD COLUMN IF NOT EXISTS score_b_90 integer;
