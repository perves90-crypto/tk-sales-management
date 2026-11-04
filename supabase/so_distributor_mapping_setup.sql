-- TK Sales Management: SO–Distributor Mapping (Excel import base)
-- Safe additive migration. Does not modify outlets or existing orders.
create table if not exists public.so_distributor_mappings (
  id uuid primary key default gen_random_uuid(),
  so_profile_id uuid not null references public.profiles(id),
  so_employee_id text not null,
  so_name text not null,
  area_id uuid not null references public.areas(id),
  so_point text not null,
  db_code text not null,
  db_name text not null,
  db_point text not null,
  active boolean not null default true,
  valid_from date not null default (now() at time zone 'Asia/Dhaka')::date,
  valid_to date,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  check (length(trim(so_point)) > 0),
  check (length(trim(db_code)) > 0),
  check (length(trim(db_name)) > 0),
  check (length(trim(db_point)) > 0),
  check (valid_to is null or valid_to >= valid_from)
);

create unique index if not exists uq_so_distributor_one_active_per_so
  on public.so_distributor_mappings(so_profile_id) where active = true;
create index if not exists idx_so_distributor_area_active
  on public.so_distributor_mappings(area_id, active);
create index if not exists idx_so_distributor_db_code
  on public.so_distributor_mappings(db_code);

alter table public.so_distributor_mappings enable row level security;
grant select, insert, update on public.so_distributor_mappings to authenticated;

drop policy if exists "rsm_manage_so_distributor_mappings" on public.so_distributor_mappings;
create policy "rsm_manage_so_distributor_mappings"
on public.so_distributor_mappings for all to authenticated
using (exists (
  select 1 from public.profiles p
  where p.id = auth.uid() and p.role::text = 'RSM' and p.active = true
))
with check (exists (
  select 1 from public.profiles p
  where p.id = auth.uid() and p.role::text = 'RSM' and p.active = true
));

drop policy if exists "so_read_own_distributor_mapping" on public.so_distributor_mappings;
create policy "so_read_own_distributor_mapping"
on public.so_distributor_mappings for select to authenticated
using (
  so_profile_id = auth.uid()
  and exists (select 1 from public.profiles p where p.id = auth.uid() and p.role::text = 'SO' and p.active = true)
);

drop policy if exists "asm_read_area_distributor_mappings" on public.so_distributor_mappings;
create policy "asm_read_area_distributor_mappings"
on public.so_distributor_mappings for select to authenticated
using (
  area_id = (select p.area_id from public.profiles p where p.id = auth.uid() and p.role::text = 'ASM' and p.active = true)
);

comment on table public.so_distributor_mappings is
'SO-to-distributor assignment history. One active distributor per SO; old assignments are deactivated, not deleted.';
