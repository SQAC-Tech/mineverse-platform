ALTER TABLE proctor_sessions
  ADD COLUMN IF NOT EXISTS warning_budget_override int,
  ADD COLUMN IF NOT EXISTS key_violation_budget_override int;
