begin;

create or replace function public.joulane_stock_notification_settings_save(
  p_token uuid,
  p_data jsonb
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  active_session public.joulane_sessions;
  actor public.joulane_staff;
  recipients jsonb;
  recipient_count integer;
  trusted_data jsonb;
begin
  select session.* into active_session
  from public.joulane_sessions session
  where session.token = p_token and session.expires_at > now();

  if active_session.token is null or active_session.surface <> 'admin' then return false; end if;

  select staff.* into actor
  from public.joulane_staff staff
  where staff.id = active_session.staff_id;

  if actor.id <> 'usr_super_admin' or not actor.allow_admin then return false; end if;
  if jsonb_typeof(p_data) <> 'object' or jsonb_typeof(p_data->'recipients') <> 'array' then return false; end if;

  recipients := p_data->'recipients';
  recipient_count := jsonb_array_length(recipients);

  if exists (
    select 1 from jsonb_array_elements(recipients) recipient
    where trim(coalesce(recipient->>'id', '')) = ''
      or trim(coalesce(recipient->>'name', '')) = ''
      or coalesce(recipient->>'phone', '') !~ '^[0-9]{8,15}$'
  ) then return false;
  end if;

  if (select count(distinct recipient->>'phone') from jsonb_array_elements(recipients) recipient) <> recipient_count then
    return false;
  end if;

  trusted_data := jsonb_build_object(
    'recipients', recipients,
    'updatedAt', now(),
    'updatedBy', actor.id,
    'updatedByName', actor.name
  );

  insert into public.joulane_store (id, data, updated_at)
  values ('stock_notification_settings', trusted_data, now())
  on conflict (id) do update set data = excluded.data, updated_at = excluded.updated_at;

  return true;
end;
$$;

revoke all on function public.joulane_stock_notification_settings_save(uuid, jsonb) from public;
grant execute on function public.joulane_stock_notification_settings_save(uuid, jsonb) to anon, authenticated;

commit;
