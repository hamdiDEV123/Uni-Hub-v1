-- Marketplace order state machine + audit events

CREATE TABLE IF NOT EXISTS public.market_order_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.market_orders(id) ON DELETE CASCADE,
  actor_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  old_status public.market_order_status,
  new_status public.market_order_status NOT NULL,
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_market_order_events_order_created
ON public.market_order_events(order_id, created_at DESC);

ALTER TABLE public.market_order_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "market_order_events_select_related_or_admin" ON public.market_order_events;
CREATE POLICY "market_order_events_select_related_or_admin"
ON public.market_order_events
FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'admin')
  OR EXISTS (
    SELECT 1 FROM public.market_orders o
    WHERE o.id = order_id
      AND (o.buyer_id = auth.uid() OR o.seller_id = auth.uid())
  )
);

-- Tighten direct UPDATE policy on market_orders:
-- normal users must use RPC transition function below.
-- Tighten direct UPDATE policy on market_orders:
-- normal users must use RPC transition function below.
DROP POLICY IF EXISTS "market_orders_update_related_or_admin" ON public.market_orders;
DROP POLICY IF EXISTS "market_orders_update_admin_only" ON public.market_orders;

CREATE POLICY "market_orders_update_admin_only"
ON public.market_orders
FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));


CREATE OR REPLACE FUNCTION public.transition_market_order_status(
  _order_id UUID,
  _new_status public.market_order_status,
  _reason TEXT DEFAULT NULL
)
RETURNS public.market_order_status
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_order public.market_orders%ROWTYPE;
  v_old public.market_order_status;
  v_is_admin BOOLEAN := false;
  v_allowed BOOLEAN := false;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'UNAUTHORIZED';
  END IF;

  SELECT * INTO v_order
  FROM public.market_orders
  WHERE id = _order_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'ORDER_NOT_FOUND';
  END IF;

  v_old := v_order.status;
  v_is_admin := public.has_role(v_user_id, 'admin');

  IF v_is_admin THEN
    v_allowed := true;
  ELSIF v_user_id = v_order.seller_id THEN
    -- Seller flow
    IF v_old = 'paid_held' AND _new_status = 'processing' THEN
      v_allowed := true;
    ELSIF v_old = 'processing' AND _new_status = 'shipped' THEN
      v_allowed := true;
    END IF;
  ELSIF v_user_id = v_order.buyer_id THEN
    -- Buyer flow
    IF v_old = 'shipped' AND _new_status = 'delivered' THEN
      v_allowed := true;
    ELSIF v_old IN ('pending_payment', 'paid_held') AND _new_status = 'cancelled' THEN
      v_allowed := true;
    END IF;
  END IF;

  IF NOT v_allowed THEN
    RAISE EXCEPTION 'INVALID_STATUS_TRANSITION';
  END IF;

  IF v_old = _new_status THEN
    RETURN v_old;
  END IF;

  UPDATE public.market_orders
  SET
    status = _new_status,
    delivered_at = CASE WHEN _new_status = 'delivered' THEN now() ELSE delivered_at END
  WHERE id = v_order.id;

  INSERT INTO public.market_order_events (order_id, actor_id, old_status, new_status, reason)
  VALUES (v_order.id, v_user_id, v_old, _new_status, _reason);

  RETURN _new_status;
END;
$$;

REVOKE ALL ON FUNCTION public.transition_market_order_status(UUID, public.market_order_status, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.transition_market_order_status(UUID, public.market_order_status, TEXT) TO authenticated;

DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.market_order_events;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
END $$;

