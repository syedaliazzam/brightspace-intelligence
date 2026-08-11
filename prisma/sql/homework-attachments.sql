ALTER TABLE public.homework
  ADD COLUMN IF NOT EXISTS homework_attachment_bucket text,
  ADD COLUMN IF NOT EXISTS homework_attachment_path text,
  ADD COLUMN IF NOT EXISTS homework_attachment_name text,
  ADD COLUMN IF NOT EXISTS homework_attachment_buckets jsonb,
  ADD COLUMN IF NOT EXISTS homework_attachment_paths jsonb,
  ADD COLUMN IF NOT EXISTS homework_attachment_names jsonb,
  ADD COLUMN IF NOT EXISTS submission_attachment_buckets jsonb,
  ADD COLUMN IF NOT EXISTS submission_attachment_paths jsonb,
  ADD COLUMN IF NOT EXISTS submission_attachment_names jsonb;
