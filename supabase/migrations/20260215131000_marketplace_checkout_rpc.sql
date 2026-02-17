-- Atomic marketplace checkout:
-- - Locks product row
-- - Validates stock/ownership/status
-- - Inserts order + payment
-- - Decrements stock and marks sold when needed

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
  v_commission_rate NUMERIC := 0.08;
  v_subtotal NUMERIC(10,2);
  v_service_fee NUMERIC(10,2) := 5;
  v_commission_fee NUMERIC(10,2);
  v_total_paid NUMERIC(10,2);
  v_seller_net NUMERIC(10,2);
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

  SELECT seller_tier
  INTO v_seller_tier
  FROM public.seller_profiles
  WHERE user_id = v_product.seller_id;

  IF v_seller_tier = 'brand' THEN
    v_commission_rate := 0.05;
  ELSIF v_seller_tier = 'pro' THEN
    v_commission_rate := 0.06;
  ELSE
    v_commission_rate := 0.08;
  END IF;

  v_subtotal := ROUND(COALESCE(v_product.price, 0)::numeric, 2);
  v_commission_fee := ROUND((v_subtotal * v_commission_rate)::numeric, 2);
  v_total_paid := ROUND((v_subtotal + v_service_fee)::numeric, 2);
  v_seller_net := ROUND((v_subtotal - v_commission_fee)::numeric, 2);

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
    otp_code
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
    (floor(1000 + random() * 9000))::int::text
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

REVOKE ALL ON FUNCTION public.create_market_checkout_order(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_market_checkout_order(UUID) TO authenticated;

