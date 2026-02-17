-- Marketplace admin product actions v1
-- Centralizes admin product operations with hard safety checks + audit log.

CREATE TABLE IF NOT EXISTS public.market_product_admin_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
  actor_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  reason TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_market_product_admin_audit_product ON public.market_product_admin_audit(product_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_market_product_admin_audit_actor ON public.market_product_admin_audit(actor_id, created_at DESC);

ALTER TABLE public.market_product_admin_audit ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "market_product_admin_audit_select_admin_only" ON public.market_product_admin_audit;
CREATE POLICY "market_product_admin_audit_select_admin_only"
ON public.market_product_admin_audit
FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "market_product_admin_audit_insert_admin_only" ON public.market_product_admin_audit;
CREATE POLICY "market_product_admin_audit_insert_admin_only"
ON public.market_product_admin_audit
FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.admin_manage_market_product(
  _product_id UUID DEFAULT NULL,
  _action TEXT DEFAULT NULL,
  _reason TEXT DEFAULT NULL
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_product public.products%ROWTYPE;
  v_has_orders BOOLEAN := false;
  v_deleted_count INTEGER := 0;
  v_action TEXT := lower(coalesce(_action, ''));
  v_result TEXT := '';
BEGIN
  IF v_user_id IS NULL OR NOT public.has_role(v_user_id, 'admin') THEN
    RAISE EXCEPTION 'UNAUTHORIZED';
  END IF;

  IF v_action = 'bulk_cleanup' THEN
    DELETE FROM public.products p
    WHERE p.moderation_status = 'rejected'
      AND p.rejected_expires_at IS NOT NULL
      AND p.rejected_expires_at <= now()
      AND NOT EXISTS (
        SELECT 1
        FROM public.market_orders o
        WHERE o.product_id = p.id
      );

    GET DIAGNOSTICS v_deleted_count = ROW_COUNT;

    INSERT INTO public.market_product_admin_audit(product_id, actor_id, action, reason, metadata)
    VALUES (NULL, v_user_id, 'bulk_cleanup', _reason, jsonb_build_object('deleted_count', v_deleted_count));

    RETURN 'bulk_cleanup_deleted_' || v_deleted_count::text;
  END IF;

  IF _product_id IS NULL THEN
    RAISE EXCEPTION 'PRODUCT_ID_REQUIRED';
  END IF;

  SELECT *
  INTO v_product
  FROM public.products
  WHERE id = _product_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'PRODUCT_NOT_FOUND';
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.market_orders
    WHERE product_id = _product_id
  ) INTO v_has_orders;

  IF v_action = 'approve' THEN
    UPDATE public.products
    SET moderation_status = 'approved',
        listing_status = 'active',
        rejection_reason = NULL,
        reviewed_by = v_user_id,
        reviewed_at = now()
    WHERE id = _product_id;
    v_result := 'approved';

  ELSIF v_action = 'reject' THEN
    IF coalesce(trim(_reason), '') = '' THEN
      RAISE EXCEPTION 'REJECTION_REASON_REQUIRED';
    END IF;

    UPDATE public.products
    SET moderation_status = 'rejected',
        listing_status = 'archived',
        rejection_reason = _reason,
        reviewed_by = v_user_id,
        reviewed_at = now()
    WHERE id = _product_id;
    v_result := 'rejected';

  ELSIF v_action = 'archive' THEN
    UPDATE public.products
    SET listing_status = 'archived'
    WHERE id = _product_id;
    v_result := 'archived';

  ELSIF v_action = 'restore_activate' THEN
    IF coalesce(v_product.stock_qty, 0) < 1 THEN
      RAISE EXCEPTION 'OUT_OF_STOCK_CANNOT_ACTIVATE';
    END IF;

    IF v_product.moderation_status = 'rejected' THEN
      RAISE EXCEPTION 'REJECTED_PRODUCT_MUST_BE_APPROVED_FIRST';
    END IF;

    UPDATE public.products
    SET listing_status = 'active'
    WHERE id = _product_id;
    v_result := 'restored';

  ELSIF v_action = 'delete_now' THEN
    IF v_has_orders THEN
      RAISE EXCEPTION 'PRODUCT_HAS_ORDERS_ARCHIVE_ONLY';
    END IF;

    DELETE FROM public.products
    WHERE id = _product_id;
    v_result := 'deleted';

  ELSE
    RAISE EXCEPTION 'INVALID_ACTION';
  END IF;

  INSERT INTO public.market_product_admin_audit(product_id, actor_id, action, reason, metadata)
  VALUES (
    _product_id,
    v_user_id,
    v_action,
    _reason,
    jsonb_build_object(
      'has_orders', v_has_orders,
      'previous_status', v_product.listing_status,
      'previous_moderation_status', v_product.moderation_status
    )
  );

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_manage_market_product(UUID, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_manage_market_product(UUID, TEXT, TEXT) TO authenticated;
