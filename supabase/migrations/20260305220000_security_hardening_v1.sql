BEGIN;

-- ========= Helpers =========
CREATE OR REPLACE FUNCTION public.is_admin(_uid UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_role(_uid, 'admin');
$$;

CREATE OR REPLACE FUNCTION public.current_uid()
RETURNS UUID
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'UNAUTHORIZED';
  END IF;
  RETURN v_uid;
END;
$$;

-- ========= Wallet ledger =========
CREATE TABLE IF NOT EXISTS public.wallet_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
  direction TEXT NOT NULL CHECK (direction IN ('debit', 'credit')),
  amount NUMERIC(10,2) NOT NULL CHECK (amount > 0),
  reason TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.wallet_ledger ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS wallet_ledger_select_self_or_admin ON public.wallet_ledger;
CREATE POLICY wallet_ledger_select_self_or_admin
ON public.wallet_ledger
FOR SELECT TO authenticated
USING (user_id = auth.uid() OR public.is_admin(auth.uid()));

DROP POLICY IF EXISTS wallet_ledger_insert_admin_only ON public.wallet_ledger;
CREATE POLICY wallet_ledger_insert_admin_only
ON public.wallet_ledger
FOR INSERT TO authenticated
WITH CHECK (public.is_admin(auth.uid()));

-- ========= Profiles hardening =========
CREATE OR REPLACE FUNCTION public.guard_profile_sensitive_columns()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_admin BOOLEAN := public.is_admin(v_uid);
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'UNAUTHORIZED';
  END IF;

  IF NOT v_admin AND v_uid <> OLD.id THEN
    RAISE EXCEPTION 'FORBIDDEN';
  END IF;

  IF NOT v_admin THEN
    IF NEW.wallet IS DISTINCT FROM OLD.wallet
       OR NEW.role IS DISTINCT FROM OLD.role
       OR NEW.verified_status IS DISTINCT FROM OLD.verified_status
       OR COALESCE(NEW.is_verified_runner, false) IS DISTINCT FROM COALESCE(OLD.is_verified_runner, false)
       OR NEW.admin_notes IS DISTINCT FROM OLD.admin_notes
       OR NEW.email IS DISTINCT FROM OLD.email THEN
      RAISE EXCEPTION 'SENSITIVE_FIELDS_UPDATE_FORBIDDEN';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_profile_sensitive_columns ON public.profiles;
CREATE TRIGGER trg_guard_profile_sensitive_columns
BEFORE UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.guard_profile_sensitive_columns();

DROP POLICY IF EXISTS "Users can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;

CREATE POLICY profiles_select_self_or_admin
ON public.profiles
FOR SELECT TO authenticated
USING (id = auth.uid() OR public.is_admin(auth.uid()));

CREATE POLICY profiles_insert_self
ON public.profiles
FOR INSERT TO authenticated
WITH CHECK (id = auth.uid());

CREATE POLICY profiles_update_self_or_admin
ON public.profiles
FOR UPDATE TO authenticated
USING (id = auth.uid() OR public.is_admin(auth.uid()))
WITH CHECK (id = auth.uid() OR public.is_admin(auth.uid()));

CREATE OR REPLACE VIEW public.profiles_public AS
SELECT id, full_name, avatar_url, university_id
FROM public.profiles;

GRANT SELECT ON public.profiles_public TO authenticated;

-- ========= Products hardening =========
DROP POLICY IF EXISTS "Anyone can view products" ON public.products;
DROP POLICY IF EXISTS "Sellers can insert products" ON public.products;
DROP POLICY IF EXISTS "Sellers can update products" ON public.products;
DROP POLICY IF EXISTS "Sellers can delete products" ON public.products;

CREATE POLICY products_select_active_or_owner_or_admin
ON public.products
FOR SELECT TO authenticated
USING (
  (listing_status = 'active' AND moderation_status = 'approved')
  OR seller_id = auth.uid()
  OR public.is_admin(auth.uid())
);

CREATE POLICY products_insert_seller_pending_only
ON public.products
FOR INSERT TO authenticated
WITH CHECK (
  seller_id = auth.uid()
  AND listing_status = 'pending_review'
  AND moderation_status = 'pending'
  AND COALESCE(is_featured, false) = false
  AND COALESCE(boost_score, 0) = 0
);

CREATE POLICY products_update_admin_only
ON public.products
FOR UPDATE TO authenticated
USING (public.is_admin(auth.uid()))
WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY products_delete_admin_only
ON public.products
FOR DELETE TO authenticated
USING (public.is_admin(auth.uid()));

-- ========= Orders hardening for delivery =========
DROP POLICY IF EXISTS "Users can view own orders" ON public.orders;
DROP POLICY IF EXISTS "Users can create orders" ON public.orders;
DROP POLICY IF EXISTS "Involved users can update orders" ON public.orders;

CREATE POLICY orders_select_related_or_admin
ON public.orders
FOR SELECT TO authenticated
USING (buyer_id = auth.uid() OR runner_id = auth.uid() OR public.is_admin(auth.uid()));

-- ========= Delivery secure RPCs =========
CREATE OR REPLACE FUNCTION public.create_delivery_order_secure(
  _title TEXT,
  _campus TEXT,
  _pickup TEXT,
  _dropoff TEXT,
  _fee NUMERIC,
  _phone TEXT,
  _type TEXT DEFAULT 'external'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := public.current_uid();
  v_wallet NUMERIC(10,2);
  v_order_id UUID;
BEGIN
  IF _title IS NULL OR btrim(_title) = '' THEN
    RAISE EXCEPTION 'TITLE_REQUIRED';
  END IF;
  IF _fee IS NULL OR _fee <= 0 THEN
    RAISE EXCEPTION 'INVALID_FEE';
  END IF;

  SELECT wallet
  INTO v_wallet
  FROM public.profiles
  WHERE id = v_uid
  FOR UPDATE;

  IF v_wallet < _fee THEN
    RAISE EXCEPTION 'INSUFFICIENT_WALLET_BALANCE';
  END IF;

  UPDATE public.profiles
  SET wallet = wallet - _fee
  WHERE id = v_uid;

  INSERT INTO public.wallet_ledger(user_id, direction, amount, reason)
  VALUES (v_uid, 'debit', _fee, 'delivery_escrow_create');

  INSERT INTO public.orders(
    buyer_id,
    title,
    description,
    location,
    fee,
    status,
    otp_code,
    phone_number,
    type
  )
  VALUES (
    v_uid,
    btrim(_title),
    _campus,
    '[' || COALESCE(_type, 'external') || '] ' || COALESCE(_pickup, '') || ' -> ' || COALESCE(_dropoff, ''),
    _fee,
    'pending',
    (floor(1000 + random() * 9000))::int::text,
    _phone,
    _type
  )
  RETURNING id INTO v_order_id;

  RETURN v_order_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.claim_delivery_order_secure(_order_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := public.current_uid();
  v_order public.orders%ROWTYPE;
BEGIN
  SELECT *
  INTO v_order
  FROM public.orders
  WHERE id = _order_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'ORDER_NOT_FOUND';
  END IF;
  IF v_order.buyer_id = v_uid THEN
    RAISE EXCEPTION 'SELF_CLAIM_FORBIDDEN';
  END IF;
  IF COALESCE(v_order.status, '') <> 'pending' OR v_order.runner_id IS NOT NULL THEN
    RAISE EXCEPTION 'ORDER_NOT_CLAIMABLE';
  END IF;

  UPDATE public.orders
  SET runner_id = v_uid, status = 'active', updated_at = now()
  WHERE id = _order_id;

  RETURN 'claimed';
END;
$$;

CREATE OR REPLACE FUNCTION public.release_delivery_order_secure(_order_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := public.current_uid();
  v_order public.orders%ROWTYPE;
BEGIN
  SELECT *
  INTO v_order
  FROM public.orders
  WHERE id = _order_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'ORDER_NOT_FOUND';
  END IF;
  IF v_order.runner_id IS DISTINCT FROM v_uid THEN
    RAISE EXCEPTION 'FORBIDDEN';
  END IF;
  IF COALESCE(v_order.status, '') <> 'active' THEN
    RAISE EXCEPTION 'INVALID_STATUS';
  END IF;

  UPDATE public.orders
  SET runner_id = NULL, status = 'pending', updated_at = now()
  WHERE id = _order_id;

  RETURN 'released';
END;
$$;

CREATE OR REPLACE FUNCTION public.complete_delivery_order_secure(
  _order_id UUID,
  _otp TEXT
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := public.current_uid();
  v_order public.orders%ROWTYPE;
BEGIN
  SELECT *
  INTO v_order
  FROM public.orders
  WHERE id = _order_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'ORDER_NOT_FOUND';
  END IF;
  IF v_order.runner_id IS DISTINCT FROM v_uid THEN
    RAISE EXCEPTION 'FORBIDDEN';
  END IF;
  IF COALESCE(v_order.status, '') <> 'active' THEN
    RAISE EXCEPTION 'INVALID_STATUS';
  END IF;
  IF COALESCE(v_order.otp_code, '') <> COALESCE(_otp, '') THEN
    RAISE EXCEPTION 'INVALID_OTP';
  END IF;

  UPDATE public.orders
  SET status = 'delivered', updated_at = now()
  WHERE id = _order_id;

  UPDATE public.profiles
  SET wallet = wallet + COALESCE(v_order.fee, 0)
  WHERE id = v_uid;

  INSERT INTO public.wallet_ledger(user_id, order_id, direction, amount, reason)
  VALUES (v_uid, v_order.id, 'credit', COALESCE(v_order.fee, 0), 'delivery_escrow_release');

  RETURN 'completed';
END;
$$;

REVOKE ALL ON FUNCTION public.create_delivery_order_secure(TEXT, TEXT, TEXT, TEXT, NUMERIC, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_delivery_order_secure(TEXT, TEXT, TEXT, TEXT, NUMERIC, TEXT, TEXT) TO authenticated;

REVOKE ALL ON FUNCTION public.claim_delivery_order_secure(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.claim_delivery_order_secure(UUID) TO authenticated;

REVOKE ALL ON FUNCTION public.release_delivery_order_secure(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.release_delivery_order_secure(UUID) TO authenticated;

REVOKE ALL ON FUNCTION public.complete_delivery_order_secure(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.complete_delivery_order_secure(UUID, TEXT) TO authenticated;

-- ========= Private receipts bucket =========
INSERT INTO storage.buckets (id, name, public)
VALUES ('market_receipts', 'market_receipts', false)
ON CONFLICT (id) DO UPDATE
SET public = false;

DROP POLICY IF EXISTS market_receipts_owner_insert ON storage.objects;
CREATE POLICY market_receipts_owner_insert
ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'market_receipts'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

DROP POLICY IF EXISTS market_receipts_owner_select_or_admin ON storage.objects;
CREATE POLICY market_receipts_owner_select_or_admin
ON storage.objects
FOR SELECT TO authenticated
USING (
  bucket_id = 'market_receipts'
  AND (
    auth.uid()::text = (storage.foldername(name))[1]
    OR public.is_admin(auth.uid())
  )
);

DROP POLICY IF EXISTS market_receipts_owner_update_or_admin ON storage.objects;
CREATE POLICY market_receipts_owner_update_or_admin
ON storage.objects
FOR UPDATE TO authenticated
USING (
  bucket_id = 'market_receipts'
  AND (
    auth.uid()::text = (storage.foldername(name))[1]
    OR public.is_admin(auth.uid())
  )
)
WITH CHECK (
  bucket_id = 'market_receipts'
  AND (
    auth.uid()::text = (storage.foldername(name))[1]
    OR public.is_admin(auth.uid())
  )
);

DROP POLICY IF EXISTS market_receipts_owner_delete_or_admin ON storage.objects;
CREATE POLICY market_receipts_owner_delete_or_admin
ON storage.objects
FOR DELETE TO authenticated
USING (
  bucket_id = 'market_receipts'
  AND (
    auth.uid()::text = (storage.foldername(name))[1]
    OR public.is_admin(auth.uid())
  )
);

COMMIT;
