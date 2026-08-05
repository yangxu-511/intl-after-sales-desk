create or replace function public.get_ticket_submission_admin_summary()
returns table (
  total_count bigint,
  pending_count bigint,
  awaiting_confirmation_count bigint,
  processing_count bigint,
  uploaded_count bigint,
  needs_review_count bigint,
  failed_count bigint,
  uncertain_count bigint
)
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $$
begin
  if lower(coalesce(auth.jwt() ->> 'email', '')) <> 'xu.yang2@getein.cn' then
    raise exception 'administrator access required' using errcode = '42501';
  end if;

  return query
  select
    count(*),
    count(*) filter (where ticket.status = 'pending'),
    count(*) filter (where ticket.status = 'awaiting_confirmation'),
    count(*) filter (where ticket.status = 'processing'),
    count(*) filter (where ticket.status = 'uploaded'),
    count(*) filter (where ticket.status = 'needs_review'),
    count(*) filter (where ticket.status = 'failed'),
    count(*) filter (where ticket.status = 'uncertain')
  from public.ticket_submissions as ticket;
end;
$$;

create or replace function public.get_ticket_submission_admin_rows(
  p_limit integer default 100,
  p_offset integer default 0
)
returns table (
  id uuid,
  client_ticket_id text,
  submitter_name text,
  submitter_email text,
  payload jsonb,
  status text,
  target_crm_owner text,
  created_at timestamptz,
  updated_at timestamptz,
  crm_work_order_number text
)
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $$
begin
  if lower(coalesce(auth.jwt() ->> 'email', '')) <> 'xu.yang2@getein.cn' then
    raise exception 'administrator access required' using errcode = '42501';
  end if;

  return query
  select
    ticket.id,
    ticket.client_ticket_id,
    ticket.submitter_name,
    ticket.submitter_email,
    ticket.payload,
    ticket.status,
    ticket.target_crm_owner,
    ticket.created_at,
    ticket.updated_at,
    ticket.crm_work_order_number
  from public.ticket_submissions as ticket
  order by ticket.created_at desc, ticket.id desc
  limit least(greatest(coalesce(p_limit, 100), 1), 100)
  offset greatest(coalesce(p_offset, 0), 0);
end;
$$;

revoke all on function public.get_ticket_submission_admin_summary() from public;
revoke all on function public.get_ticket_submission_admin_summary() from anon;
grant execute on function public.get_ticket_submission_admin_summary() to authenticated;

revoke all on function public.get_ticket_submission_admin_rows(integer, integer) from public;
revoke all on function public.get_ticket_submission_admin_rows(integer, integer) from anon;
grant execute on function public.get_ticket_submission_admin_rows(integer, integer) to authenticated;

comment on function public.get_ticket_submission_admin_summary() is
  'Read-only queue totals restricted to xu.yang2@getein.cn.';

comment on function public.get_ticket_submission_admin_rows(integer, integer) is
  'Read-only queue details restricted to xu.yang2@getein.cn, limited to 100 rows per request.';
