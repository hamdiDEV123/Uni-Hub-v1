-- Marketplace tiers + policy matrix v1
-- Target tiers: casual / student_pro / big_store
-- IMPORTANT: run migration 20260215195500_marketplace_seller_tier_enum_values.sql first.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'seller_tier' AND e.enumlabel = 'student_pro'
  ) OR NOT EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'seller_tier' AND e.enumlabel = 'big_store'
  ) THEN
    RAISE EXCEPTION 'Missing seller_tier enum values. Run migration 20260215195500_marketplace_seller_tier_enum_values.sql first.';
  END IF;
END $$;

-- Migrate legacy tiers to new naming
UPDATE public.seller_profiles SET seller_tier = 'student_pro' WHERE seller_tier = 'brand';
UPDATE public.seller_profiles SET seller_tier = 'big_store' WHERE seller_tier = 'pro';

-- Tier policy matrix
CREATE TABLE IF NOT EXISTS public.market_seller_policies (
  tier public.seller_tier PRIMARY KEY,
  monthly_subscription_egp NUMERIC(10,2) NOT NULL DEFAULT 0,
  intro_subscription_egp NUMERIC(10,2) NOT NULL DEFAULT 0,
  commission_rate NUMERIC(6,5),
  use_variable_commission BOOLEAN NOT NULL DEFAULT false,
  commission_rate_low NUMERIC(6,5),
  commission_rate_mid NUMERIC(6,5),
  commission_rate_high NUMERIC(6,5),
  threshold_low_egp NUMERIC(10,2),
  threshold_mid_egp NUMERIC(10,2),
  hold_days INTEGER NOT NULL DEFAULT 7,
  per_sale_package_fee_egp NUMERIC(10,2) NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.market_seller_policies ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "market_seller_policies_select_authenticated" ON public.market_seller_policies;
CREATE POLICY "market_seller_policies_select_authenticated"
ON public.market_seller_policies
FOR SELECT TO authenticated
USING (true);

DROP POLICY IF EXISTS "market_seller_policies_admin_insert" ON public.market_seller_policies;
CREATE POLICY "market_seller_policies_admin_insert"
ON public.market_seller_policies
FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "market_seller_policies_admin_update" ON public.market_seller_policies;
CREATE POLICY "market_seller_policies_admin_update"
ON public.market_seller_policies
FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'update_updated_at_column') THEN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_market_seller_policies_updated_at') THEN
      CREATE TRIGGER update_market_seller_policies_updated_at
      BEFORE UPDATE ON public.market_seller_policies
      FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
    END IF;
  END IF;
END $$;

INSERT INTO public.market_seller_policies (
  tier,
  monthly_subscription_egp,
  intro_subscription_egp,
  commission_rate,
  use_variable_commission,
  commission_rate_low,
  commission_rate_mid,
  commission_rate_high,
  threshold_low_egp,
  threshold_mid_egp,
  hold_days,
  per_sale_package_fee_egp,
  is_active
)
VALUES
  ('casual', 0, 0, 0.10, false, NULL, NULL, NULL, NULL, NULL, 7, 0, true),
  ('student_pro', 150, 99, 0.05, false, NULL, NULL, NULL, NULL, NULL, 2, 1, true),
  ('big_store', 1000, 1000, NULL, true, 0.06, 0.05, 0.025, 500, 3000, 2, 0, true)
ON CONFLICT (tier) DO UPDATE SET
  monthly_subscription_egp = EXCLUDED.monthly_subscription_egp,
  intro_subscription_egp = EXCLUDED.intro_subscription_egp,
  commission_rate = EXCLUDED.commission_rate,
  use_variable_commission = EXCLUDED.use_variable_commission,
  commission_rate_low = EXCLUDED.commission_rate_low,
  commission_rate_mid = EXCLUDED.commission_rate_mid,
  commission_rate_high = EXCLUDED.commission_rate_high,
  threshold_low_egp = EXCLUDED.threshold_low_egp,
  threshold_mid_egp = EXCLUDED.threshold_mid_egp,
  hold_days = EXCLUDED.hold_days,
  per_sale_package_fee_egp = EXCLUDED.per_sale_package_fee_egp,
  is_active = EXCLUDED.is_active;

-- Platform fee settings
CREATE TABLE IF NOT EXISTS public.market_fee_settings (
  id BOOLEAN PRIMARY KEY DEFAULT true CHECK (id = true),
  gateway_rate NUMERIC(8,5) NOT NULL DEFAULT 0.0275,
  gateway_fixed_egp NUMERIC(10,2) NOT NULL DEFAULT 3,
  service_buffer_egp NUMERIC(10,2) NOT NULL DEFAULT 4,
  withdrawal_fee_egp NUMERIC(10,2) NOT NULL DEFAULT 5,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.market_fee_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "market_fee_settings_select_authenticated" ON public.market_fee_settings;
CREATE POLICY "market_fee_settings_select_authenticated"
ON public.market_fee_settings
FOR SELECT TO authenticated
USING (true);

DROP POLICY IF EXISTS "market_fee_settings_admin_update" ON public.market_fee_settings;
CREATE POLICY "market_fee_settings_admin_update"
ON public.market_fee_settings
FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "market_fee_settings_admin_insert" ON public.market_fee_settings;
CREATE POLICY "market_fee_settings_admin_insert"
ON public.market_fee_settings
FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'update_updated_at_column') THEN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_market_fee_settings_updated_at') THEN
      CREATE TRIGGER update_market_fee_settings_updated_at
      BEFORE UPDATE ON public.market_fee_settings
      FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
    END IF;
  END IF;
END $$;

INSERT INTO public.market_fee_settings (id, gateway_rate, gateway_fixed_egp, service_buffer_egp, withdrawal_fee_egp)
VALUES (true, 0.0275, 3, 4, 5)
ON CONFLICT (id) DO NOTHING;

-- Extend market_orders with settlement snapshot fields
ALTER TABLE public.market_orders
  ADD COLUMN IF NOT EXISTS seller_tier_snapshot public.seller_tier DEFAULT 'casual',
  ADD COLUMN IF NOT EXISTS hold_days_snapshot INTEGER DEFAULT 7,
  ADD COLUMN IF NOT EXISTS hold_release_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS package_fee NUMERIC(10,2) NOT NULL DEFAULT 0;

CREATE OR REPLACE FUNCTION public.normalize_seller_tier(_tier public.seller_tier)
RETURNS public.seller_tier
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF _tier = 'brand' THEN
    RETURN 'student_pro';
  ELSIF _tier = 'pro' THEN
    RETURN 'big_store';
  END IF;
  RETURN COALESCE(_tier, 'casual');
END;
$$;

CREATE OR REPLACE FUNCTION public.get_market_commission_rate(
  _seller_tier public.seller_tier,
  _subtotal NUMERIC
)
RETURNS NUMERIC
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tier public.seller_tier := public.normalize_seller_tier(_seller_tier);
  v_policy public.market_seller_policies%ROWTYPE;
BEGIN
  SELECT *
  INTO v_policy
  FROM public.market_seller_policies
  WHERE tier = v_tier AND is_active = true;

  IF NOT FOUND THEN
    RETURN 0.10;
  END IF;

  IF COALESCE(v_policy.use_variable_commission, false) THEN
    IF _subtotal <= COALESCE(v_policy.threshold_low_egp, 500) THEN
      RETURN COALESCE(v_policy.commission_rate_low, 0.06);
    ELSIF _subtotal <= COALESCE(v_policy.threshold_mid_egp, 3000) THEN
      RETURN COALESCE(v_policy.commission_rate_mid, 0.05);
    ELSE
      RETURN COALESCE(v_policy.commission_rate_high, 0.025);
    END IF;
  END IF;

  RETURN COALESCE(v_policy.commission_rate, 0.10);
END;
$$;

CREATE OR REPLACE FUNCTION public.get_market_service_fee(_subtotal NUMERIC)
RETURNS NUMERIC
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_settings public.market_fee_settings%ROWTYPE;
BEGIN
  SELECT *
  INTO v_settings
  FROM public.market_fee_settings
  WHERE id = true;

  IF NOT FOUND THEN
    RETURN ROUND((_subtotal * 0.0275 + 3 + 4)::numeric, 2);
  END IF;

  RETURN ROUND((_subtotal * v_settings.gateway_rate + v_settings.gateway_fixed_egp + v_settings.service_buffer_egp)::numeric, 2);
END;
$$;

-- Checkout function uses policy matrix instead of hardcoded tiers
CREATE OR REPLACE FUNCTION public.create_market_checkout_order(
  _product_id UUID
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_product public.products%ROWTYPE;
  v_order_id UUID;
  v_seller_tier public.seller_tier := 'casual';
  v_commission_rate NUMERIC := 0.10;
  v_subtotal NUMERIC(10,2);
  v_service_fee NUMERIC(10,2) := 5;
  v_commission_fee NUMERIC(10,2);
  v_total_paid NUMERIC(10,2);
  v_seller_net NUMERIC(10,2);
  v_policy public.market_seller_policies%ROWTYPE;
  v_hold_days INTEGER := 7;
  v_package_fee NUMERIC(10,2) := 0;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'UNAUTHORIZED';
  END IF;

  SELECT *
  INTO v_product
  FROM public.products
  WHERE id = _product_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'PRODUCT_NOT_FOUND';
  END IF;

  IF v_product.seller_id = v_user_id THEN
    RAISE EXCEPTION 'SELF_PURCHASE_NOT_ALLOWED';
  END IF;

  IF COALESCE(v_product.listing_status, 'active') <> 'active' THEN
    RAISE EXCEPTION 'PRODUCT_NOT_ACTIVE';
  END IF;

  IF COALESCE(v_product.stock_qty, 0) < 1 THEN
    RAISE EXCEPTION 'OUT_OF_STOCK';
  END IF;

  SELECT COALESCE(seller_tier, 'casual')
  INTO v_seller_tier
  FROM public.seller_profiles
  WHERE user_id = v_product.seller_id;

  v_seller_tier := public.normalize_seller_tier(v_seller_tier);

  SELECT *
  INTO v_policy
  FROM public.market_seller_policies
  WHERE tier = v_seller_tier AND is_active = true;

  IF FOUND THEN
    v_hold_days := COALESCE(v_policy.hold_days, 7);
    v_package_fee := COALESCE(v_policy.per_sale_package_fee_egp, 0);
  END IF;

  v_subtotal := ROUND(COALESCE(v_product.price, 0)::numeric, 2);
  v_commission_rate := public.get_market_commission_rate(v_seller_tier, v_subtotal);
  v_service_fee := public.get_market_service_fee(v_subtotal);
  v_commission_fee := ROUND((v_subtotal * v_commission_rate)::numeric, 2);
  v_total_paid := ROUND((v_subtotal + v_service_fee)::numeric, 2);
  v_seller_net := ROUND((v_subtotal - v_commission_fee - v_package_fee)::numeric, 2);

  INSERT INTO public.market_orders (
    buyer_id,
    seller_id,
    product_id,
    quantity,
    unit_price,
    subtotal,
    service_fee,
    commission_fee,
    total_paid,
    seller_net_amount,
    payment_status,
    status,
    otp_code,
    seller_tier_snapshot,
    hold_days_snapshot,
    hold_release_at,
    package_fee
  )
  VALUES (
    v_user_id,
    v_product.seller_id,
    v_product.id,
    1,
    v_subtotal,
    v_subtotal,
    v_service_fee,
    v_commission_fee,
    v_total_paid,
    v_seller_net,
    'pending',
    'pending_payment',
    (floor(1000 + random() * 9000))::int::text,
    v_seller_tier,
    v_hold_days,
    now() + make_interval(days => v_hold_days),
    v_package_fee
  )
  RETURNING id INTO v_order_id;

  INSERT INTO public.market_payments (
    order_id,
    buyer_id,
    provider,
    amount,
    status
  )
  VALUES (
    v_order_id,
    v_user_id,
    'platform_checkout',
    v_total_paid,
    'pending'
  );

  UPDATE public.products
  SET
    stock_qty = stock_qty - 1,
    listing_status = CASE WHEN stock_qty - 1 <= 0 THEN 'sold' ELSE listing_status END
  WHERE id = v_product.id;

  RETURN v_order_id;
END;
$$;

REVOKE ALL ON FUNCTION public.get_market_commission_rate(public.seller_tier, NUMERIC) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_market_commission_rate(public.seller_tier, NUMERIC) TO authenticated;

REVOKE ALL ON FUNCTION public.get_market_service_fee(NUMERIC) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_market_service_fee(NUMERIC) TO authenticated;

REVOKE ALL ON FUNCTION public.create_market_checkout_order(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_market_checkout_order(UUID) TO authenticated;
