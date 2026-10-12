ALTER TABLE public.public_events
  ADD COLUMN IF NOT EXISTS schedule_days jsonb NOT NULL DEFAULT '[]'::jsonb;
