-- SOURCE OF TRUTH (Marketplace listing modes v3)
-- Adds listing modes to products (sale/rental/barter/service)
-- and introduces:
--   public.create_market_product_listing_v3_secure(...)

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'market_listing_mode'
      AND n.nspname = 'public'
  ) THEN
    CREATE TYPE public.market_listing_mode AS ENUM ('sale', 'rental', 'barter', 'service');
  END IF;
END $$;

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS listing_mode public.market_listing_mode NOT NULL DEFAULT 'sale',
  ADD COLUMN IF NOT EXISTS rental_price_per_day NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS barter_for TEXT,
  ADD COLUMN IF NOT EXISTS service_delivery_days INTEGER;

CREATE OR REPLACE FUNCTION public.create_market_product_listing_v3_secure(
  _title TEXT,
  _description TEXT DEFAULT '',
  _category public.product_category DEFAULT 'Tech',
  _price NUMERIC DEFAULT 0,
  _stock_qty INTEGER DEFAULT 1,
  _product_condition TEXT DEFAULT 'used',
  _phone TEXT DEFAULT NULL,
  _image_urls TEXT[] DEFAULT ARRAY[]::TEXT[],
  _is_negotiable BOOLEAN DEFAULT false,
  _listing_mode public.market_listing_mode DEFAULT 'sale',
  _rental_price_per_day NUMERIC DEFAULT NULL,
  _barter_for TEXT DEFAULT NULL,
  _service_delivery_days INTEGER DEFAULT NULL
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
  v_effective_price NUMERIC := COALESCE(_price, 0);
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'UNAUTHORIZED';
  END IF;

  IF NOT public.check_rate_limit('product_create', 10, 1440) THEN
    RAISE EXCEPTION 'RATE_LIMIT_EXCEEDED: Too many products created today. Please wait before creating another listing.';
  END IF;

  SELECT id INTO v_vendor_id FROM public.vendors WHERE user_id = v_user_id LIMIT 1;
  IF v_vendor_id IS NULL THEN
    INSERT INTO public.vendors(user_id, type, shop_name, created_at)
    VALUES (v_user_id, 'casual', 'Student Shop', now())
    RETURNING id INTO v_vendor_id;
  END IF;

  IF _title IS NULL OR btrim(_title) = '' THEN
    RAISE EXCEPTION 'TITLE_REQUIRED';
  END IF;

  IF _stock_qty IS NULL OR _stock_qty < 1 THEN
    RAISE EXCEPTION 'INVALID_STOCK';
  END IF;

  IF array_length(v_images, 1) IS NULL OR array_length(v_images, 1) < 1 THEN
    RAISE EXCEPTION 'IMAGE_REQUIRED';
  END IF;

  IF _listing_mode IN ('sale', 'rental', 'service') THEN
    IF _price IS NULL OR _price <= 0 THEN
      RAISE EXCEPTION 'INVALID_PRICE';
    END IF;
  END IF;

  IF _listing_mode = 'rental' THEN
    IF _rental_price_per_day IS NULL OR _rental_price_per_day <= 0 THEN
      RAISE EXCEPTION 'INVALID_RENTAL_PRICE';
    END IF;
  END IF;

  IF _listing_mode = 'barter' THEN
    IF _barter_for IS NULL OR btrim(_barter_for) = '' THEN
      RAISE EXCEPTION 'BARTER_TARGET_REQUIRED';
    END IF;
    v_effective_price := 1;
  END IF;

  IF _listing_mode = 'service' THEN
    IF _service_delivery_days IS NULL OR _service_delivery_days < 1 THEN
      RAISE EXCEPTION 'INVALID_SERVICE_DELIVERY_DAYS';
    END IF;
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
    boost_score,
    listing_mode,
    rental_price_per_day,
    barter_for,
    service_delivery_days
  )
  VALUES (
    v_user_id,
    v_vendor_id,
    btrim(_title),
    NULLIF(btrim(_description), ''),
    _category,
    ROUND(v_effective_price::numeric, 2),
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
    0,
    _listing_mode,
    CASE WHEN _listing_mode = 'rental' THEN ROUND(_rental_price_per_day::numeric, 2) ELSE NULL END,
    CASE WHEN _listing_mode = 'barter' THEN NULLIF(btrim(_barter_for), '') ELSE NULL END,
    CASE WHEN _listing_mode = 'service' THEN _service_delivery_days ELSE NULL END
  )
  RETURNING id INTO v_product_id;

  RETURN v_product_id;
END;
$$;

REVOKE ALL ON FUNCTION public.create_market_product_listing_v3_secure(
  TEXT,
  TEXT,
  public.product_category,
  NUMERIC,
  INTEGER,
  TEXT,
  TEXT,
  TEXT[],
  BOOLEAN,
  public.market_listing_mode,
  NUMERIC,
  TEXT,
  INTEGER
) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.create_market_product_listing_v3_secure(
  TEXT,
  TEXT,
  public.product_category,
  NUMERIC,
  INTEGER,
  TEXT,
  TEXT,
  TEXT[],
  BOOLEAN,
  public.market_listing_mode,
  NUMERIC,
  TEXT,
  INTEGER
) TO authenticated;
