create or replace function public.joulane_guard_immutable_stock_history()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  old_count integer;
  new_count integer;
  index_value integer;
begin
  if old.id not in ('stock_logs', 'stock_snapshots', 'stock_audits') then
    return new;
  end if;

  if jsonb_typeof(old.data) <> 'array' or jsonb_typeof(new.data) <> 'array' then
    raise exception 'immutable_history';
  end if;

  old_count := jsonb_array_length(old.data);
  new_count := jsonb_array_length(new.data);
  if new_count < old_count then
    raise exception 'immutable_history';
  end if;

  if old_count > 0 then
    for index_value in 0..old_count - 1 loop
      if old.data -> index_value is distinct from new.data -> (new_count - old_count + index_value) then
        raise exception 'immutable_history';
      end if;
    end loop;
  end if;

  return new;
end;
$$;

drop trigger if exists joulane_immutable_stock_history on public.joulane_store;
create trigger joulane_immutable_stock_history
before update of data on public.joulane_store
for each row
execute function public.joulane_guard_immutable_stock_history();
