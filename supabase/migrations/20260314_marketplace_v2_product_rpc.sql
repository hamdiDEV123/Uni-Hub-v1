-- SOURCE OF TRUTH (Marketplace product listing RPC)
-- This migration currently defines the canonical implementation of:
--   public.create_market_product_listing_secure(...)
-- It builds on:
--   - Rate limiting primitives from 20260312_p0_critical_fixes.sql (check_rate_limit / rate_limits)
--   - Security / RLS hardening from earlier marketplace migrations
-- IMPORTANT:
-- - When updating create_market_product_listing_secure in the future, prefer creating a NEW migration
--   rather than re-running or editing older migrations.
-- - Do NOT re-apply older definitions of this RPC from previous files (see docs/DB_MIGRATIONS.md).
--
-- Update marketplace product listing RPC to attach vendor_id and auto-create vendor

CREATE OR REPLACE FUNCTION public.create_market_product_listing_secure(
  _title TEXT,
  _description TEXT DEFAULT '',
  _category public.product_category DEFAULT 'Tech',
  _price NUMERIC DEFAULT 0,
  _stock_qty INTEGER DEFAULT 1,
  _product_condition TEXT DEFAULT 'used',
  _phone TEXT DEFAULT NULL,
  _image_urls TEXT[] DEFAULT ARRAY[]::TEXT[],
  _is_negotiable BOOLEAN DEFAULT false
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_product_id UUID;
  v_vendor_id UUID;
  v_images TEXT[] := COALESCE(_image_urls, ARRAY[]::TEXT[]);
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'UNAUTHORIZED';
  END IF;

  -- Rate limit product creation (already enforced by prior migration)
  IF NOT public.check_rate_limit('product_create', 10, 1440) THEN
    RAISE EXCEPTION 'RATE_LIMIT_EXCEEDED: Too many products created today. Please wait before creating another listing.';
  END IF;

  -- vendor lookup/creation
  SELECT id INTO v_vendor_id FROM public.vendors WHERE user_id = v_user_id LIMIT 1;
  IF v_vendor_id IS NULL THEN
    INSERT INTO public.vendors(user_id, type, shop_name, created_at)
    VALUES (v_user_id, 'casual', 'Student Shop', now())
    RETURNING id INTO v_vendor_id;
  END IF;

  -- basic validation
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
    vendor_id,
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
    v_user_id,
    v_vendor_id,
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

-- update grants
REVOKE ALL ON FUNCTION public.create_market_product_listing_secure(TEXT, TEXT, public.product_category, NUMERIC, INTEGER, TEXT, TEXT, TEXT[], BOOLEAN) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_market_product_listing_secure(TEXT, TEXT, public.product_category, NUMERIC, INTEGER, TEXT, TEXT, TEXT[], BOOLEAN) TO authenticated;
