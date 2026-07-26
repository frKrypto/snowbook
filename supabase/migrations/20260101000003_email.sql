-- Snowbook — email notification bookkeeping
--
-- Just enough state to show "last emailed …" in the console and to stop the
-- studio double-sending. Existing RLS policies already cover these columns.

alter table public.invoices
  add column if not exists last_emailed_at timestamptz;

alter table public.projects
  add column if not exists delivery_notified_at timestamptz;
