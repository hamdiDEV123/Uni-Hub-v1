BEGIN;

CREATE OR REPLACE FUNCTION public.review_market_payout_request(
  _payout_id UUID,
  _approve BOOLEAN,
  _admin_note TEXT DEFAULT NULL
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_row public.market_payouts%ROWTYPE;
BEGIN
  IF v_uid IS NULL OR NOT public.is_admin(v_uid) THEN
    RAISE EXCEPTION 'UNAUTHORIZED';
  END IF;

  SELECT *
  INTO v_row
  FROM public.market_payouts
  WHERE id = _payout_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'PAYOUT_NOT_FOUND';
  END IF;

  IF COALESCE(v_row.status, '') <> 'pending' THEN
    RAISE EXCEPTION 'PAYOUT_NOT_PENDING';
  END IF;

  UPDATE public.market_payouts
  SET
    status = CASE WHEN _approve THEN 'paid' ELSE 'rejected' END,
    note = COALESCE(NULLIF(btrim(_admin_note), ''), note),
    updated_at = now()
  WHERE id = _payout_id;

  RETURN CASE WHEN _approve THEN 'paid' ELSE 'rejected' END;
END;
$$;

REVOKE ALL ON FUNCTION public.review_market_payout_request(UUID, BOOLEAN, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.review_market_payout_request(UUID, BOOLEAN, TEXT) TO authenticated;

COMMIT;
