ALTER TABLE public.public_events
  ADD COLUMN IF NOT EXISTS registration_form_schema jsonb NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE public.public_event_registrations
  ADD COLUMN IF NOT EXISTS custom_field_values jsonb NOT NULL DEFAULT '{}'::jsonb;
