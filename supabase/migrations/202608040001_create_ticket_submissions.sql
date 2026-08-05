
create table if not exists public.ticket_submissions (
  id uuid primary key,
  client_ticket_id text not null unique,
  submitter_user_id uuid not null references auth.users(id) on delete restrict,
  submitter_name text not null,
  submitter_email text not null,
  payload jsonb not null,
  payload_version integer not null default 1,
  status text not null default 'pending' check (
    status in (
      'pending',
      'awaiting_confirmation',
      'processing',
      'uploaded',
      'needs_review',
      'failed',
      'uncertain'
    )
  ),
  target_crm_owner text not null default '徐阳',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  collected_at timestamptz,
  processing_started_at timestamptz,
  uploaded_at timestamptz,
  attempt_count integer not null default 0 check (attempt_count >= 0),
  last_error text,
  crm_record_id text unique,
  crm_work_order_number text,
  crm_owner text
);

create index if not exists ticket_submissions_status_created_at_idx
  on public.ticket_submissions (status, created_at);

create or replace function public.set_ticket_submission_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_ticket_submission_updated_at on public.ticket_submissions;
create trigger set_ticket_submission_updated_at
before update on public.ticket_submissions
for each row execute function public.set_ticket_submission_updated_at();

alter table public.ticket_submissions enable row level security;

drop policy if exists "submitters insert their own tickets" on public.ticket_submissions;
create policy "submitters insert their own tickets"
on public.ticket_submissions
for insert
to authenticated
with check (
  submitter_user_id = auth.uid()
  and lower(submitter_email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  and status = 'pending'
  and target_crm_owner = '徐阳'
);

drop policy if exists "submitters read their own tickets" on public.ticket_submissions;
create policy "submitters read their own tickets"
on public.ticket_submissions
for select
to authenticated
using (submitter_user_id = auth.uid());

revoke all on table public.ticket_submissions from anon;
grant insert, select on table public.ticket_submissions to authenticated;

comment on table public.ticket_submissions is
  'Queue from the international service desk to confirmed SalesEasy fieldJob creation.';
