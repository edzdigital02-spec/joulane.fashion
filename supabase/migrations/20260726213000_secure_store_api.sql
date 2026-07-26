create extension if not exists pgcrypto with schema extensions;

create table if not exists public.joulane_staff (
  id text primary key,
  name text not null,
  role text not null default 'Staff',
  passcode_hash text not null,
  allow_admin boolean not null default false,
  allow_stock boolean not null default false,
  permissions jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.joulane_sessions (
  token uuid primary key default gen_random_uuid(),
  staff_id text not null references public.joulane_staff(id) on delete cascade,
  surface text not null check (surface in ('admin', 'stock')),
  expires_at timestamptz not null default (now() + interval '8 hours'),
  created_at timestamptz not null default now()
);

alter table public.joulane_staff enable row level security;
alter table public.joulane_sessions enable row level security;

revoke all on public.joulane_staff from anon, authenticated;
revoke all on public.joulane_sessions from anon, authenticated;

do $$
declare
  staff_user jsonb;
begin
  for staff_user in
    select value
    from public.joulane_store source,
      jsonb_array_elements(
        case when jsonb_typeof(source.data) = 'array' then source.data else '[]'::jsonb end
      )
    where source.id = 'users'
  loop
    insert into public.joulane_staff (
      id,
      name,
      role,
      passcode_hash,
      allow_admin,
      allow_stock,
      permissions
    ) values (
      coalesce(nullif(staff_user->>'id', ''), 'usr_' || gen_random_uuid()::text),
      coalesce(nullif(staff_user->>'name', ''), 'Staff'),
      coalesce(nullif(staff_user->>'role', ''), 'Staff'),
      extensions.crypt(coalesce(nullif(staff_user->>'passcode', ''), '1234'), extensions.gen_salt('bf', 10)),
      coalesce((staff_user->>'allowAdmin')::boolean, false),
      coalesce((staff_user->>'allowStock')::boolean, false),
      coalesce(staff_user->'permissions', '{}'::jsonb)
    ) on conflict (id) do nothing;
  end loop;
end
$$;

create or replace function public.joulane_staff_json(staff public.joulane_staff)
returns jsonb
language sql
immutable
set search_path = public
as $$
  select jsonb_build_object(
    'id', staff.id,
    'name', staff.name,
    'role', staff.role,
    'passcode', '',
    'allowAdmin', staff.allow_admin,
    'allowStock', staff.allow_stock,
    'permissions', staff.permissions
  );
$$;

create or replace function public.joulane_staff_directory()
returns jsonb
language sql
security definer
set search_path = public
as $$
  select coalesce(jsonb_agg(public.joulane_staff_json(staff) order by staff.created_at), '[]'::jsonb)
  from public.joulane_staff staff;
$$;

create or replace function public.joulane_login(
  p_user_identifier text,
  p_passcode text,
  p_surface text
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  matched_staff public.joulane_staff;
  new_token uuid;
  normalized_user text := lower(trim(coalesce(p_user_identifier, '')));
begin
  if p_surface not in ('admin', 'stock') or length(trim(coalesce(p_passcode, ''))) < 4 then
    return null;
  end if;

  delete from public.joulane_sessions where expires_at <= now();

  select staff.* into matched_staff
  from public.joulane_staff staff
  where (
      normalized_user in ('', 'all')
      or lower(staff.id) = normalized_user
      or lower(staff.name) = normalized_user
    )
    and extensions.crypt(trim(p_passcode), staff.passcode_hash) = staff.passcode_hash
    and case when p_surface = 'admin' then staff.allow_admin else staff.allow_stock end
  order by (staff.id = 'usr_super_admin') desc
  limit 1;

  if matched_staff.id is null then return null; end if;

  insert into public.joulane_sessions (staff_id, surface)
  values (matched_staff.id, p_surface)
  returning token into new_token;

  return jsonb_build_object(
    'token', new_token,
    'expiresAt', now() + interval '8 hours',
    'user', public.joulane_staff_json(matched_staff)
  );
end;
$$;

create or replace function public.joulane_secure_data(p_token uuid)
returns table (id text, data jsonb, updated_at timestamptz)
language plpgsql
security definer
set search_path = public
as $$
declare
  active_session public.joulane_sessions;
begin
  select session.* into active_session
  from public.joulane_sessions session
  where session.token = p_token and session.expires_at > now();

  if active_session.token is null then
    raise exception 'Secure session is invalid or expired' using errcode = 'P0001';
  end if;

  return query
  select store.id, store.data, store.updated_at
  from public.joulane_store store
  where active_session.surface = 'admin'
    and store.id in ('config', 'products', 'categories', 'orders', 'shipping', 'stock_logs')
  union all
  select store.id, store.data, store.updated_at
  from public.joulane_store store
  where active_session.surface = 'stock'
    and store.id in ('products', 'stock_logs');
end;
$$;

create or replace function public.joulane_secure_write(
  p_token uuid,
  p_id text,
  p_data jsonb
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  active_session public.joulane_sessions;
  staff public.joulane_staff;
begin
  select session.* into active_session
  from public.joulane_sessions session
  where session.token = p_token and session.expires_at > now();
  if active_session.token is null then return false; end if;

  select account.* into staff from public.joulane_staff account where account.id = active_session.staff_id;
  if staff.id is null then return false; end if;

  if active_session.surface = 'admin' then
    if not staff.allow_admin or p_id not in ('config', 'products', 'categories', 'orders', 'shipping', 'stock_logs') then
      return false;
    end if;
  elsif active_session.surface = 'stock' then
    if not staff.allow_stock or p_id not in ('products', 'stock_logs') then
      return false;
    end if;
  else
    return false;
  end if;

  insert into public.joulane_store (id, data, updated_at)
  values (p_id, p_data, now())
  on conflict (id) do update set data = excluded.data, updated_at = excluded.updated_at;
  return true;
end;
$$;

create or replace function public.joulane_submit_order(p_order jsonb)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if nullif(trim(p_order->>'id'), '') is null
    or nullif(trim(p_order->>'customerName'), '') is null
    or nullif(trim(p_order->>'phone'), '') is null then
    return false;
  end if;

  insert into public.joulane_store (id, data, updated_at)
  values ('orders', jsonb_build_array(p_order), now())
  on conflict (id) do update
  set data = case
      when exists (
        select 1 from jsonb_array_elements(
          case when jsonb_typeof(public.joulane_store.data) = 'array' then public.joulane_store.data else '[]'::jsonb end
        ) item where item->>'id' = p_order->>'id'
      ) then public.joulane_store.data
      else jsonb_build_array(p_order) ||
        case when jsonb_typeof(public.joulane_store.data) = 'array' then public.joulane_store.data else '[]'::jsonb end
    end,
    updated_at = now();
  return true;
end;
$$;

create or replace function public.joulane_staff_save(p_token uuid, p_users jsonb)
returns boolean
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  active_session public.joulane_sessions;
  actor public.joulane_staff;
  staff_user jsonb;
  raw_passcode text;
begin
  select session.* into active_session
  from public.joulane_sessions session
  where session.token = p_token and session.expires_at > now() and session.surface = 'admin';
  if active_session.token is null or jsonb_typeof(p_users) <> 'array' then return false; end if;

  select account.* into actor from public.joulane_staff account where account.id = active_session.staff_id;
  if actor.id is null or not actor.allow_admin
    or not coalesce((actor.permissions->>'adminUsers')::boolean, actor.id = 'usr_super_admin') then
    return false;
  end if;

  for staff_user in select value from jsonb_array_elements(p_users)
  loop
    raw_passcode := nullif(trim(staff_user->>'passcode'), '');
    insert into public.joulane_staff (
      id, name, role, passcode_hash, allow_admin, allow_stock, permissions, updated_at
    ) values (
      staff_user->>'id',
      coalesce(nullif(staff_user->>'name', ''), 'Staff'),
      coalesce(nullif(staff_user->>'role', ''), 'Staff'),
      extensions.crypt(coalesce(raw_passcode, '1234'), extensions.gen_salt('bf', 10)),
      coalesce((staff_user->>'allowAdmin')::boolean, false),
      coalesce((staff_user->>'allowStock')::boolean, false),
      coalesce(staff_user->'permissions', '{}'::jsonb),
      now()
    ) on conflict (id) do update set
      name = excluded.name,
      role = excluded.role,
      passcode_hash = case
        when raw_passcode is null then public.joulane_staff.passcode_hash
        else excluded.passcode_hash
      end,
      allow_admin = excluded.allow_admin,
      allow_stock = excluded.allow_stock,
      permissions = excluded.permissions,
      updated_at = now();
  end loop;

  delete from public.joulane_staff staff
  where staff.id <> 'usr_super_admin'
    and staff.id <> actor.id
    and not exists (
      select 1 from jsonb_array_elements(p_users) candidate where candidate->>'id' = staff.id
    );
  return true;
end;
$$;

revoke all on function public.joulane_staff_directory() from public;
revoke all on function public.joulane_login(text, text, text) from public;
revoke all on function public.joulane_secure_data(uuid) from public;
revoke all on function public.joulane_secure_write(uuid, text, jsonb) from public;
revoke all on function public.joulane_submit_order(jsonb) from public;
revoke all on function public.joulane_staff_save(uuid, jsonb) from public;

grant execute on function public.joulane_staff_directory() to anon, authenticated;
grant execute on function public.joulane_login(text, text, text) to anon, authenticated;
grant execute on function public.joulane_secure_data(uuid) to anon, authenticated;
grant execute on function public.joulane_secure_write(uuid, text, jsonb) to anon, authenticated;
grant execute on function public.joulane_submit_order(jsonb) to anon, authenticated;
grant execute on function public.joulane_staff_save(uuid, jsonb) to anon, authenticated;
