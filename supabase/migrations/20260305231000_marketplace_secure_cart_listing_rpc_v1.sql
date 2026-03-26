-- Marketplace secure cart + listing RPCs (v1)
-- This migration introduced:
--   - RLS hardening and unique index for public.market_cart_items
--   - public.add_market_cart_item_secure(...)  → CURRENT source-of-truth for the "add to cart" RPC
--   - public.create_market_product_listing_secure(...)  → superseded later by 20260314_marketplace_v2_product_rpc.sql
-- IMPORTANT:
-- - Treat add_market_cart_item_secure in this file as the authoritative implementation unless a newer
--   migration explicitly replaces it.
-- - The product listing RPC defined here is considered a v1 implementation and has been replaced by
--   the v2 implementation in 20260314_marketplace_v2_product_rpc.sql.
-- - See docs/DB_MIGRATIONS.md for the full RPC evolution timeline.

BEGIN;

-- =============================
-- Marketplace cart hardening
-- =============================
ALTER TABLE public.market_cart_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.market_cart_items FORCE ROW LEVEL SECURITY;

CREATE UNIQUE INDEX IF NOT EXISTS ux_market_cart_items_user_product
ON public.market_cart_items(user_id, product_id);

DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'market_cart_items'
      AND policyname NOT IN (
        'market_cart_items_select_own',
        'market_cart_items_insert_own',
        'market_cart_items_update_own',
        'market_cart_items_delete_own'
      )
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.market_cart_items;', r.policyname);
  END LOOP;
END
$$;

DROP POLICY IF EXISTS market_cart_items_select_own ON public.market_cart_items;
CREATE POLICY market_cart_items_select_own
ON public.market_cart_items
FOR SELECT TO authenticated
USING (user_id = auth.uid());

DROP POLICY IF EXISTS market_cart_items_insert_own ON public.market_cart_items;
CREATE POLICY market_cart_items_insert_own
ON public.market_cart_items
FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS market_cart_items_update_own ON public.market_cart_items;
CREATE POLICY market_cart_items_update_own
ON public.market_cart_items
FOR UPDATE TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS market_cart_items_delete_own ON public.market_cart_items;
CREATE POLICY market_cart_items_delete_own
ON public.market_cart_items
FOR DELETE TO authenticated
USING (user_id = auth.uid());

-- =============================
-- Secure RPC: add to cart
-- =============================
CREATE OR REPLACE FUNCTION public.add_market_cart_item_secure(
  _product_id UUID,
  _quantity INTEGER DEFAULT 1
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := public.current_uid();
  v_product public.products%ROWTYPE;
  v_quantity INTEGER;
BEGIN
  IF _product_id IS NULL THEN
    RAISE EXCEPTION 'PRODUCT_REQUIRED';
  END IF;

  IF _quantity IS NULL OR _quantity < 1 OR _quantity > 20 THEN
    RAISE EXCEPTION 'INVALID_QUANTITY';
  END IF;

  SELECT *
  INTO v_product
  FROM public.products
  WHERE id = _product_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'PRODUCT_NOT_FOUND';
  END IF;

  IF v_product.seller_id = v_uid THEN
    RAISE EXCEPTION 'SELF_PURCHASE_NOT_ALLOWED';
  END IF;

  IF COALESCE(v_product.listing_status, '') <> 'active'
     OR COALESCE(v_product.moderation_status, '') <> 'approved' THEN
    RAISE EXCEPTION 'PRODUCT_NOT_AVAILABLE';
  END IF;

  IF COALESCE(v_product.stock_qty, 0) <= 0 THEN
    RAISE EXCEPTION 'OUT_OF_STOCK';
  END IF;

  INSERT INTO public.market_cart_items(user_id, product_id, quantity)
  VALUES (v_uid, _product_id, _quantity)
  ON CONFLICT (user_id, product_id)
  DO UPDATE SET
    quantity = LEAST(99, public.market_cart_items.quantity + EXCLUDED.quantity),
    updated_at = now()
  RETURNING quantity INTO v_quantity;

  RETURN v_quantity;
END;
$$;

REVOKE ALL ON FUNCTION public.add_market_cart_item_secure(UUID, INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.add_market_cart_item_secure(UUID, INTEGER) TO authenticated;

-- =============================
-- Secure RPC: create listing
-- =============================
DROP POLICY IF EXISTS products_insert_seller_pending_only ON public.products;
DROP POLICY IF EXISTS products_insert_admin_only ON public.products;

CREATE POLICY products_insert_admin_only
ON public.products
FOR INSERT TO authenticated
WITH CHECK (public.is_admin(auth.uid()));

CREATE OR REPLACE FUNCTION public.create_market_product_listing_secure(
  _title TEXT,
  _description TEXT,
  _category public.product_category,
  _price NUMERIC,
  _stock_qty INTEGER,
  _product_condition TEXT DEFAULT 'used',
  _phone TEXT DEFAULT NULL,
  _image_urls TEXT[] DEFAULT NULL,
  _is_negotiable BOOLEAN DEFAULT FALSE
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := public.current_uid();
  v_product_id UUID;
  v_images TEXT[] := COALESCE(_image_urls, ARRAY[]::TEXT[]);
BEGIN
  IF _title IS NULL OR btrim(_title) = '' THEN
    RAISE EXCEPTION 'TITLE_REQUIRED';
  END IF;

  IF _price IS NULL OR _price <= 0 THEN
    RAISE EXCEPTION 'INVALID_PRICE';
  END IF;

  IF _stock_qty IS NULL OR _stock_qty < 1 THEN
    RAISE EXCEPTION 'INVALID_STOCK';
  END IF;

  IF array_length(v_images, 1) IS NULL OR array_length(v_images, 1) < 1 THEN
    RAISE EXCEPTION 'IMAGE_REQUIRED';
  END IF;

  INSERT INTO public.products (
    seller_id,
    title,
    description,
    category,
    price,
    stock_qty,
    product_condition,
    condition,
    phone,
    image_url,
    is_negotiable,
    is_featured,
    listing_status,
    moderation_status,
    status,
    boost_score
  )
  VALUES (
    v_uid,
    btrim(_title),
    NULLIF(btrim(_description), ''),
    _category,
    ROUND(_price::numeric, 2),
    _stock_qty,
    COALESCE(NULLIF(btrim(_product_condition), ''), 'used'),
    COALESCE(NULLIF(btrim(_product_condition), ''), 'used'),
    NULLIF(btrim(_phone), ''),
    v_images,
    COALESCE(_is_negotiable, FALSE),
    FALSE,
    'pending_review',
    'pending',
    'available',
    0
  )
  RETURNING id INTO v_product_id;

  RETURN v_product_id;
END;
$$;

REVOKE ALL ON FUNCTION public.create_market_product_listing_secure(TEXT, TEXT, public.product_category, NUMERIC, INTEGER, TEXT, TEXT, TEXT[], BOOLEAN) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_market_product_listing_secure(TEXT, TEXT, public.product_category, NUMERIC, INTEGER, TEXT, TEXT, TEXT[], BOOLEAN) TO authenticated;

COMMIT;
