begin;

create or replace function public.joulane_secure_data(p_token uuid)
returns table (id text, data jsonb, updated_at timestamptz)
language plpgsql
security definer
set search_path = public
as $$
declare
  active_session public.joulane_sessions;
  actor public.joulane_staff;
begin
  select session.* into active_session
  from public.joulane_sessions session
  where session.token = p_token and session.expires_at > now();

  if active_session.token is null then
    raise exception 'Secure session is invalid or expired' using errcode = 'P0001';
  end if;

  select staff.* into actor
  from public.joulane_staff staff
  where staff.id = active_session.staff_id;

  if actor.id is null then
    raise exception 'Staff account is unavailable' using errcode = 'P0001';
  end if;

  return query
  select store.id, store.data, store.updated_at
  from public.joulane_store store
  where (
      active_session.surface = 'admin'
      and actor.allow_admin
      and store.id = 'orders'
      and (actor.id = 'usr_super_admin' or coalesce((actor.permissions->>'adminOrders')::boolean, false))
    ) or (
      active_session.surface = 'stock'
      and actor.allow_stock
      and store.id = 'stock_logs'
      and (actor.id = 'usr_super_admin' or coalesce((actor.permissions->>'stockViewLogs')::boolean, false))
    ) or (
      active_session.surface = 'stock'
      and actor.allow_stock
      and store.id = 'orders'
      and (actor.id = 'usr_super_admin' or coalesce((actor.permissions->>'stockRemove')::boolean, false))
    );
end;
$$;

revoke all on function public.joulane_secure_data(uuid) from public;
grant execute on function public.joulane_secure_data(uuid) to anon, authenticated;

commit;
