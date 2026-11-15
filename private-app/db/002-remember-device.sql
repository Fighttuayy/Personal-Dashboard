-- Opt-in remembered sessions. NULL preserves the existing 30-minute idle rule.
alter table fortor.session_guard add column if not exists remembered_until timestamptz;
