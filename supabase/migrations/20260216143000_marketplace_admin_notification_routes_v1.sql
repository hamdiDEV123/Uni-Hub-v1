-- Marketplace admin notification route normalization
-- Goal:
-- 1) add a single helper for admin console deep links
-- 2) centralize section routing inside notify_market_admins_with_link
-- 3) normalize existing admin notifications links

CREATE OR REPLACE FUNCTION public.market_admin_route(_section TEXT DEFAULT NULL)
RETURNS TEXT
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_section TEXT := lower(coalesce(_section, ''));
BEGIN
  IF v_section = '' OR v_section = 'overview' THEN
    RETURN '/admin/marketplace';
  END IF;

  IF v_section IN ('products', 'receipts', 'upgrades', 'payouts', 'disputes') THEN
    RETURN '/admin/marketplace?section=' || v_section;
  END IF;

  RETURN '/admin/marketplace';
END;
$$;

CREATE OR REPLACE FUNCTION public.notify_market_admins_with_link(
  _title TEXT,
  _message TEXT,
  _link TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin_id UUID;
  v_link TEXT := NULLIF(trim(coalesce(_link, '')), '');
  v_text TEXT := lower(coalesce(_title, '') || ' ' || coalesce(_message, ''));
BEGIN
  -- Route selection is centralized here, so upstream event producers can stay simple.
  IF v_link IS NULL
     OR v_link IN ('/admin', '/admin/marketplace')
     OR v_link LIKE '/marketplace/orders%' THEN
    IF v_text LIKE '%receipt%' OR v_text LIKE '%manual payment%' OR v_text LIKE '%اثبات%' OR v_text LIKE '%إثبات%' THEN
      v_link := public.market_admin_route('receipts');
    ELSIF v_text LIKE '%upgrade%' OR v_text LIKE '%tier%' OR v_text LIKE '%ترقية%' THEN
      v_link := public.market_admin_route('upgrades');
    ELSIF v_text LIKE '%withdraw%' OR v_text LIKE '%payout%' OR v_text LIKE '%سحب%' THEN
      v_link := public.market_admin_route('payouts');
    ELSIF v_text LIKE '%dispute%' OR v_text LIKE '%نزاع%' THEN
      v_link := public.market_admin_route('disputes');
    ELSIF v_text LIKE '%product%' OR v_text LIKE '%review%' OR v_text LIKE '%منتج%' OR v_text LIKE '%مراجعة%' THEN
      v_link := public.market_admin_route('products');
    ELSE
      v_link := public.market_admin_route('overview');
    END IF;
  END IF;

  FOR v_admin_id IN
    SELECT ur.user_id
    FROM public.user_roles ur
    WHERE ur.role = 'admin'
  LOOP
    PERFORM public.create_market_notification(v_admin_id, _title, _message, v_link);
  END LOOP;
END;
$$;

-- Best-effort normalization for existing admin notifications.
UPDATE public.notifications n
SET link = CASE
  WHEN (n.link IS NULL OR n.link IN ('/admin', '/admin/marketplace') OR n.link LIKE '/marketplace/orders%')
       AND (lower(coalesce(n.title, '') || ' ' || coalesce(n.message, '')) LIKE '%receipt%'
            OR lower(coalesce(n.title, '') || ' ' || coalesce(n.message, '')) LIKE '%manual payment%'
            OR lower(coalesce(n.title, '') || ' ' || coalesce(n.message, '')) LIKE '%اثبات%'
            OR lower(coalesce(n.title, '') || ' ' || coalesce(n.message, '')) LIKE '%إثبات%')
    THEN public.market_admin_route('receipts')
  WHEN (n.link IS NULL OR n.link IN ('/admin', '/admin/marketplace') OR n.link LIKE '/marketplace/orders%')
       AND (lower(coalesce(n.title, '') || ' ' || coalesce(n.message, '')) LIKE '%upgrade%'
            OR lower(coalesce(n.title, '') || ' ' || coalesce(n.message, '')) LIKE '%tier%'
            OR lower(coalesce(n.title, '') || ' ' || coalesce(n.message, '')) LIKE '%ترقية%')
    THEN public.market_admin_route('upgrades')
  WHEN (n.link IS NULL OR n.link IN ('/admin', '/admin/marketplace') OR n.link LIKE '/marketplace/orders%')
       AND (lower(coalesce(n.title, '') || ' ' || coalesce(n.message, '')) LIKE '%withdraw%'
            OR lower(coalesce(n.title, '') || ' ' || coalesce(n.message, '')) LIKE '%payout%'
            OR lower(coalesce(n.title, '') || ' ' || coalesce(n.message, '')) LIKE '%سحب%')
    THEN public.market_admin_route('payouts')
  WHEN (n.link IS NULL OR n.link IN ('/admin', '/admin/marketplace') OR n.link LIKE '/marketplace/orders%')
       AND (lower(coalesce(n.title, '') || ' ' || coalesce(n.message, '')) LIKE '%dispute%'
            OR lower(coalesce(n.title, '') || ' ' || coalesce(n.message, '')) LIKE '%نزاع%')
    THEN public.market_admin_route('disputes')
  WHEN (n.link IS NULL OR n.link IN ('/admin', '/admin/marketplace') OR n.link LIKE '/marketplace/orders%')
       AND (lower(coalesce(n.title, '') || ' ' || coalesce(n.message, '')) LIKE '%product%'
            OR lower(coalesce(n.title, '') || ' ' || coalesce(n.message, '')) LIKE '%review%'
            OR lower(coalesce(n.title, '') || ' ' || coalesce(n.message, '')) LIKE '%منتج%'
            OR lower(coalesce(n.title, '') || ' ' || coalesce(n.message, '')) LIKE '%مراجعة%')
    THEN public.market_admin_route('products')
  ELSE n.link
END
WHERE EXISTS (
  SELECT 1
  FROM public.user_roles ur
  WHERE ur.user_id = n.user_id
    AND ur.role = 'admin'
);
