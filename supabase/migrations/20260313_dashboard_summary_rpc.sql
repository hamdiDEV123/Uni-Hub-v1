-- Dashboard summary RPC
-- Run this in Supabase SQL Editor (can be added to migrations directory if you use automated deploys)

CREATE OR REPLACE FUNCTION public.get_dashboard_summary(
  user_id UUID
)
RETURNS TABLE (
  profile JSONB,
  order_count INT,
  product_count INT,
  notification_count INT
)
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT
    row_to_json(p.*) AS profile,
    COUNT(DISTINCT mo.id)::INT AS order_count,
    COUNT(DISTINCT prod.id)::INT AS product_count,
    COUNT(DISTINCT n.id)::INT AS notification_count
  FROM profiles p
  LEFT JOIN market_orders mo ON mo.buyer_id = p.id
  LEFT JOIN products prod ON prod.seller_id = p.id
  -- note: column is `is_read` not `read` (avoids reserved keyword conflict)
  LEFT JOIN notifications n ON n.user_id = p.id AND n.is_read = false
  WHERE p.id = user_id
  GROUP BY p.id;
$$;

-- developers: after creating this function, the frontend will call
-- supabase.rpc('get_dashboard_summary', { user_id })
