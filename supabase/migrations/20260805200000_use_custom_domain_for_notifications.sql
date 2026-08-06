create or replace function public.joulane_enqueue_new_order_notification()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  new_order jsonb;
  previous_orders jsonb := '[]'::jsonb;
begin
  if new.id <> 'orders' or jsonb_typeof(new.data) <> 'array' then
    return new;
  end if;
  if tg_op = 'UPDATE' and jsonb_typeof(old.data) = 'array' then
    previous_orders := old.data;
  end if;

  for new_order in
    select item.value
    from jsonb_array_elements(new.data) item(value)
    where nullif(trim(item.value->>'id'), '') is not null
      and not exists (
        select 1
        from jsonb_array_elements(previous_orders) previous(value)
        where previous.value->>'id' = item.value->>'id'
      )
  loop
    perform net.http_post(
      url := 'https://www.joulanefashion.com/api/order-notification',
      headers := jsonb_build_object('Content-Type', 'application/json'),
      body := jsonb_build_object('orderId', new_order->>'id'),
      timeout_milliseconds := 10000
    );
  end loop;
  return new;
end;
$$;

revoke all on function public.joulane_enqueue_new_order_notification() from public;
