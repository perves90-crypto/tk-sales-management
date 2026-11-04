-- Product pricing master upgrade: distributor + retailer rates + MRP.
-- Safe additive migration; existing SKU/order history is preserved.
alter table public.skus
  add column if not exists retailer_carton_rate numeric(12,2),
  add column if not exists retailer_per_piece_rate numeric(14,6)
    generated always as (retailer_carton_rate / nullif(pieces_per_carton,0)) stored,
  add column if not exists mrp numeric(12,2),
  add column if not exists item_weight_kg numeric(10,3);

comment on column public.skus.carton_rate is 'Distributor (DP) carton rate';
comment on column public.skus.per_piece_rate is 'Generated distributor per-piece rate';
comment on column public.skus.retailer_carton_rate is 'Retailer/shopkeeper carton purchase rate';
comment on column public.skus.retailer_per_piece_rate is 'Generated retailer per-piece purchase rate';
comment on column public.skus.mrp is 'Maximum retail price per piece';
comment on column public.skus.item_weight_kg is 'Per carton/bag weight in kg, from official price list';

-- Keep existing products visible; new price fields are nullable until official rates are imported.
create index if not exists idx_skus_item_code on public.skus(sku_code);
