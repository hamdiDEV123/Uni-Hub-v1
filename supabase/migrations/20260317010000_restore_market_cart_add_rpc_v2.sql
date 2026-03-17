-- Restore authoritative add-to-cart RPC after legacy hotfix override
-- Root cause: 20260312_p0_critical_fixes.sql replaced add_market_cart_item_secure
-- with an incomplete draft that returned success without inserting cart rows.

BEGIN;

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

COMMIT;
