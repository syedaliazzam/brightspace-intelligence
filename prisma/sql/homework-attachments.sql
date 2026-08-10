ALTER TABLE public.homework
  ADD COLUMN IF NOT EXISTS homework_attachment_bucket text,
  ADD COLUMN IF NOT EXISTS homework_attachment_path text,
  ADD COLUMN IF NOT EXISTS homework_attachment_name text;
