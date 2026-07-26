drop policy if exists "Allow public insert access" on public.joulane_store;
drop policy if exists "Allow public read access" on public.joulane_store;
drop policy if exists "Allow public update access" on public.joulane_store;

create policy "Read public storefront data"
on public.joulane_store
for select
to anon, authenticated
using (id in ('config', 'products', 'categories', 'shipping'));

revoke insert, update, delete on public.joulane_store from anon, authenticated;

delete from public.joulane_store where id = 'users';
