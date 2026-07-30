begin;

create table if not exists public.fee_history_records (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.student_profiles(id) on delete cascade,
  batch_id uuid null references public.regular_monthly_fee_batches(id) on delete set null,
  voucher_id uuid null references public.fee_vouchers(id) on delete set null,
  registration_id uuid null references public.registration_leads(id) on delete set null,
  month_label text null,
  due_date date null,
  previous_month_due numeric(12,2) not null default 0,
  discount_amount numeric(12,2) not null default 0,
  current_month_fee numeric(12,2) not null default 0,
  total_amount numeric(12,2) not null default 0,
  this_month_paid numeric(12,2) not null default 0,
  remaining_due numeric(12,2) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint fee_history_records_voucher_id_key unique (voucher_id)
);

create index if not exists idx_fee_history_records_student_id
  on public.fee_history_records(student_id);

create index if not exists idx_fee_history_records_due_date
  on public.fee_history_records(due_date desc);

create index if not exists idx_fee_history_records_registration_id
  on public.fee_history_records(registration_id);

drop trigger if exists trg_fee_history_records_updated_at on public.fee_history_records;
create trigger trg_fee_history_records_updated_at
before update on public.fee_history_records
for each row execute function set_updated_at();

commit;
