-- Bill new orders at retailer/shopkeeper purchase rate.
-- Keep DP, retailer rate and MRP snapshots for audit; old orders remain unchanged.
ALTER TABLE public.sales_order_items
  ADD COLUMN IF NOT EXISTS retailer_carton_rate NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS retailer_per_piece_rate NUMERIC(14,6),
  ADD COLUMN IF NOT EXISTS mrp NUMERIC(12,2);

create or replace function public.create_sales_order(
  p_outlet_id uuid,
  p_order_date date,
  p_discount numeric,
  p_paid numeric,
  p_notes text,
  p_items jsonb
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_role text;
  v_area_id uuid;
  v_order_id uuid;
  v_gross numeric(14,2) := 0;
  v_total_pieces integer := 0;
  v_discount numeric(14,2) := greatest(coalesce(p_discount,0),0);
  v_paid numeric(14,2) := greatest(coalesce(p_paid,0),0);
  v_item jsonb;
  v_sku public.skus%rowtype;
  v_cartons integer;
  v_dozens integer;
  v_pieces integer;
  v_total integer;
  v_free integer;
  v_line numeric(14,2);
begin
  if v_user_id is null then raise exception 'Login required'; end if;
  select role::text, area_id into v_role, v_area_id
  from public.profiles where id = v_user_id and active = true;
  if v_role not in ('SO','ASM') or v_area_id is null then
    raise exception 'Only active SO/ASM users with an assigned area can submit orders';
  end if;
  if not exists (
    select 1 from public.outlets
    where id = p_outlet_id and area_id = v_area_id and active = true
      and (v_role <> 'SO' or created_by = v_user_id)
  ) then raise exception 'Outlet is not available for this user'; end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'Add at least one product quantity';
  end if;

  for v_item in select value from jsonb_array_elements(p_items)
  loop
    v_cartons := greatest(coalesce((v_item->>'carton_qty')::integer,0),0);
    v_dozens := greatest(coalesce((v_item->>'dozen_qty')::integer,0),0);
    v_pieces := greatest(coalesce((v_item->>'piece_qty')::integer,0),0);
    v_free := greatest(coalesce((v_item->>'free_pieces')::integer,0),0);
    if v_cartons + v_dozens + v_pieces + v_free = 0 then continue; end if;
    select * into v_sku from public.skus
      where id = (v_item->>'sku_id')::uuid and active = true;
    if not found then raise exception 'A selected SKU is unavailable'; end if;
    v_total := v_cartons * v_sku.pieces_per_carton + v_dozens * 12 + v_pieces;
    v_line := round(v_total * v_sku.retailer_per_piece_rate,2);
    v_total_pieces := v_total_pieces + v_total;
    v_gross := v_gross + v_line;
  end loop;
  if v_total_pieces = 0 then raise exception 'Enter an order quantity'; end if;
  if v_discount > v_gross then raise exception 'Discount cannot exceed gross order value'; end if;
  if v_paid > v_gross - v_discount then raise exception 'Paid amount cannot exceed net order value'; end if;

  insert into public.sales_orders(
    outlet_id, area_id, created_by, order_date, total_pieces,
    gross_value, discount_amount, net_value, paid_amount, balance_amount, notes
  ) values (
    p_outlet_id, v_area_id, v_user_id, coalesce(p_order_date,(now() at time zone 'Asia/Dhaka')::date),
    v_total_pieces, v_gross, v_discount, v_gross-v_discount, v_paid,
    v_gross-v_discount-v_paid, nullif(trim(coalesce(p_notes,'')),'')
  ) returning id into v_order_id;

  for v_item in select value from jsonb_array_elements(p_items)
  loop
    v_cartons := greatest(coalesce((v_item->>'carton_qty')::integer,0),0);
    v_dozens := greatest(coalesce((v_item->>'dozen_qty')::integer,0),0);
    v_pieces := greatest(coalesce((v_item->>'piece_qty')::integer,0),0);
    v_free := greatest(coalesce((v_item->>'free_pieces')::integer,0),0);
    if v_cartons + v_dozens + v_pieces + v_free = 0 then continue; end if;
    select * into v_sku from public.skus
      where id = (v_item->>'sku_id')::uuid and active = true;
    v_total := v_cartons * v_sku.pieces_per_carton + v_dozens * 12 + v_pieces;
    v_line := round(v_total * v_sku.retailer_per_piece_rate,2);
    insert into public.sales_order_items(
      order_id, sku_id, category, product_name, product_size,
      pieces_per_carton, carton_rate, per_piece_rate,
      retailer_carton_rate, retailer_per_piece_rate, mrp,
      carton_qty, dozen_qty, piece_qty, total_pieces, free_pieces, line_value
    ) values (
      v_order_id, v_sku.id, v_sku.category, v_sku.product_name, v_sku.product_size,
      v_sku.pieces_per_carton, v_sku.carton_rate, v_sku.per_piece_rate,
      v_sku.retailer_carton_rate, v_sku.retailer_per_piece_rate, v_sku.mrp,
      v_cartons, v_dozens, v_pieces, v_total, v_free, v_line
    );
  end loop;
  return v_order_id;
end;
$$;

revoke all on function public.create_sales_order(uuid,date,numeric,numeric,text,jsonb) from public;
grant execute on function public.create_sales_order(uuid,date,numeric,numeric,text,jsonb) to authenticated;

