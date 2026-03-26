-- Marketplace v2 vendor RPCs

-- 1. create vendor record for user (if not exists)
CREATE OR REPLACE FUNCTION public.create_vendor(
  _user_id UUID,
  _type TEXT,
  _shop_name TEXT,
  _logo_url TEXT DEFAULT NULL,
  _campus_id UUID DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_id UUID;
BEGIN
  -- validate type
  IF _type NOT IN ('casual','student_pro','big_brand','external') THEN
    RAISE EXCEPTION 'INVALID_VENDOR_TYPE';
  END IF;

  SELECT id INTO v_id FROM public.vendors WHERE user_id = _user_id;
  IF FOUND THEN
    -- update existing vendor
    UPDATE public.vendors
    SET type = _type,
        shop_name = _shop_name,
        logo_url = _logo_url,
        campus_id = _campus_id,
        updated_at = now()
    WHERE id = v_id;
    RETURN v_id;
  END IF;

  INSERT INTO public.vendors(user_id, type, shop_name, logo_url, campus_id)
  VALUES (_user_id, _type, _shop_name, _logo_url, _campus_id)
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

-- 2. fetch vendor by user
CREATE OR REPLACE FUNCTION public.get_vendor_by_user(
  _user_id UUID
)
RETURNS TABLE (
  id UUID,
  type TEXT,
  shop_name TEXT,
  logo_url TEXT,
  verified BOOLEAN,
  campus_id UUID,
  subscription_status TEXT
)
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT id, type, shop_name, logo_url, verified, campus_id, subscription_status
  FROM public.vendors
  WHERE user_id = _user_id;
$$;

-- 3. commission calculator (simple config; could later query vendor_settings)
CREATE OR REPLACE FUNCTION public.calculate_commission(
  _vendor_id UUID,
  _order_total NUMERIC
)
RETURNS NUMERIC
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_type TEXT;
  v_rate NUMERIC := 0.10;
BEGIN
  SELECT type INTO v_type FROM public.vendors WHERE id = _vendor_id;
  IF NOT FOUND THEN
    RETURN 0;
  END IF;

  CASE v_type
    WHEN 'casual' THEN v_rate := 0.10;
    WHEN 'student_pro' THEN v_rate := 0.05;
    WHEN 'big_brand' THEN
      -- variable commission by value (6/5/2.5)
      IF _order_total <= 500 THEN
        v_rate := 0.06;
      ELSIF _order_total <= 3000 THEN
        v_rate := 0.05;
      ELSE
        v_rate := 0.025;
      END IF;
    WHEN 'external' THEN v_rate := 0.08; -- default for external
  END CASE;

  RETURN _order_total * v_rate;
END;
$$;

-- 4. helper to get vendor settings in one query
CREATE OR REPLACE FUNCTION public.get_vendor_settings(
  _vendor_id UUID
)
RETURNS TABLE (commission_rate NUMERIC, shipping_fee NUMERIC, currency TEXT)
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT
    COALESCE(vs.commission_rate, 0.10) AS commission_rate,
    COALESCE(vs.shipping_fee, 0) AS shipping_fee,
    COALESCE(vs.currency, 'EGP') AS currency
  FROM public.vendor_settings vs
  WHERE vs.vendor_id = _vendor_id;
$$;
