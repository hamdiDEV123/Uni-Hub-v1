-- Marketplace RLS + permission smoke checks
-- Run this in Supabase SQL editor after each migration.

-- 1) RLS status on critical marketplace tables
SELECT
  n.nspname AS schema_name,
  c.relname AS table_name,
  c.relrowsecurity AS rls_enabled,
  c.relforcerowsecurity AS rls_forced
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relname IN (
    'products',
    'market_cart_items',
    'market_orders',
    'market_order_events',
    'market_seller_policies',
    'market_fee_settings',
    'market_product_admin_audit'
  )
ORDER BY c.relname;

-- 2) Missing policies (expected but not found)
WITH expected_policies AS (
  SELECT * FROM (VALUES
    ('public', 'products', 'products_select_active_or_owner_or_admin'),
    ('public', 'products', 'products_insert_admin_only'),
    ('public', 'products', 'products_update_admin_only'),
    ('public', 'products', 'products_delete_admin_only'),
    ('public', 'market_cart_items', 'market_cart_items_select_own'),
    ('public', 'market_cart_items', 'market_cart_items_insert_own'),
    ('public', 'market_cart_items', 'market_cart_items_update_own'),
    ('public', 'market_cart_items', 'market_cart_items_delete_own'),
    ('public', 'market_orders', 'market_orders_update_admin_only'),
    ('public', 'market_order_events', 'market_order_events_select_related_or_admin'),
    ('public', 'market_seller_policies', 'market_seller_policies_select_authenticated'),
    ('public', 'market_seller_policies', 'market_seller_policies_admin_insert'),
    ('public', 'market_seller_policies', 'market_seller_policies_admin_update'),
    ('public', 'market_fee_settings', 'market_fee_settings_select_authenticated'),
    ('public', 'market_fee_settings', 'market_fee_settings_admin_insert'),
    ('public', 'market_fee_settings', 'market_fee_settings_admin_update'),
    ('public', 'market_product_admin_audit', 'market_product_admin_audit_select_admin_only'),
    ('public', 'market_product_admin_audit', 'market_product_admin_audit_insert_admin_only'),
    ('storage', 'objects', 'product_images_public_read'),
    ('storage', 'objects', 'product_images_auth_upload_own_folder'),
    ('storage', 'objects', 'product_images_auth_update_own_folder'),
    ('storage', 'objects', 'product_images_auth_delete_own_folder'),
    ('storage', 'objects', 'market_receipts_owner_insert'),
    ('storage', 'objects', 'market_receipts_owner_select_or_admin'),
    ('storage', 'objects', 'market_receipts_owner_update_or_admin'),
    ('storage', 'objects', 'market_receipts_owner_delete_or_admin')
  ) AS t(schemaname, tablename, policyname)
)
SELECT
  e.schemaname,
  e.tablename,
  e.policyname AS missing_policy
FROM expected_policies e
LEFT JOIN pg_policies p
  ON p.schemaname = e.schemaname
 AND p.tablename = e.tablename
 AND p.policyname = e.policyname
WHERE p.policyname IS NULL
ORDER BY e.schemaname, e.tablename, e.policyname;

-- 3) Unexpected policies (present but not in expected allowlist)
WITH expected_policies AS (
  SELECT * FROM (VALUES
    ('public', 'products', 'products_select_active_or_owner_or_admin'),
    ('public', 'products', 'products_insert_admin_only'),
    ('public', 'products', 'products_update_admin_only'),
    ('public', 'products', 'products_delete_admin_only'),
    ('public', 'market_cart_items', 'market_cart_items_select_own'),
    ('public', 'market_cart_items', 'market_cart_items_insert_own'),
    ('public', 'market_cart_items', 'market_cart_items_update_own'),
    ('public', 'market_cart_items', 'market_cart_items_delete_own'),
    ('public', 'market_orders', 'market_orders_update_admin_only'),
    ('public', 'market_order_events', 'market_order_events_select_related_or_admin'),
    ('public', 'market_seller_policies', 'market_seller_policies_select_authenticated'),
    ('public', 'market_seller_policies', 'market_seller_policies_admin_insert'),
    ('public', 'market_seller_policies', 'market_seller_policies_admin_update'),
    ('public', 'market_fee_settings', 'market_fee_settings_select_authenticated'),
    ('public', 'market_fee_settings', 'market_fee_settings_admin_insert'),
    ('public', 'market_fee_settings', 'market_fee_settings_admin_update'),
    ('public', 'market_product_admin_audit', 'market_product_admin_audit_select_admin_only'),
    ('public', 'market_product_admin_audit', 'market_product_admin_audit_insert_admin_only'),
    ('storage', 'objects', 'product_images_public_read'),
    ('storage', 'objects', 'product_images_auth_upload_own_folder'),
    ('storage', 'objects', 'product_images_auth_update_own_folder'),
    ('storage', 'objects', 'product_images_auth_delete_own_folder'),
    ('storage', 'objects', 'market_receipts_owner_insert'),
    ('storage', 'objects', 'market_receipts_owner_select_or_admin'),
    ('storage', 'objects', 'market_receipts_owner_update_or_admin'),
    ('storage', 'objects', 'market_receipts_owner_delete_or_admin')
  ) AS t(schemaname, tablename, policyname)
)
SELECT
  p.schemaname,
  p.tablename,
  p.policyname AS unexpected_policy
FROM pg_policies p
LEFT JOIN expected_policies e
  ON e.schemaname = p.schemaname
 AND e.tablename = p.tablename
 AND e.policyname = p.policyname
WHERE (
    (p.schemaname = 'public' AND p.tablename IN (
      'products',
      'market_cart_items',
      'market_orders',
      'market_order_events',
      'market_seller_policies',
      'market_fee_settings',
      'market_product_admin_audit'
    ))
    OR (p.schemaname = 'storage' AND p.tablename = 'objects')
  )
  AND (
    (p.schemaname = 'storage' AND (
      p.policyname LIKE 'product_images_%'
      OR p.policyname LIKE 'market_receipts_%'
    ))
    OR p.schemaname = 'public'
  )
  AND e.policyname IS NULL
ORDER BY p.schemaname, p.tablename, p.policyname;

-- 4) RPC grant checks (must not be exposed to PUBLIC)
WITH expected_functions AS (
  SELECT * FROM (VALUES
    ('public', 'add_market_cart_item_secure'),
    ('public', 'create_market_product_listing_secure'),
    ('public', 'create_market_checkout_order'),
    ('public', 'transition_market_order_status'),
    ('public', 'admin_manage_market_product'),
    ('public', 'review_market_payout_request')
  ) AS t(schemaname, function_name)
),
fn AS (
  SELECT
    n.nspname AS schemaname,
    p.proname AS function_name,
    p.oid
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
)
SELECT
  e.schemaname,
  e.function_name,
  (f.oid IS NOT NULL) AS function_exists,
  CASE
    WHEN f.oid IS NULL THEN NULL
    ELSE has_function_privilege('public', f.oid, 'EXECUTE')
  END AS public_can_execute
FROM expected_functions e
LEFT JOIN fn f
  ON f.schemaname = e.schemaname
 AND f.function_name = e.function_name
ORDER BY e.function_name;

-- 5) Buckets existence + visibility
-- expected:
--   product_images  => public = true
--   market_receipts => public = false
SELECT
  id,
  name,
  public
FROM storage.buckets
WHERE id IN ('product_images', 'market_receipts')
ORDER BY id;
