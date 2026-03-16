-- NOTE: Non-authoritative copy of marketplace_ad_views / vendor_settings / marketplace_ads schema migration
-- This file lives under /migrations, while the official migration path for Supabase is /supabase/migrations.
-- It should be treated as a historical copy / development artifact only.
-- IMPORTANT:
-- - Supabase CLI / production migration runners MUST source migrations from /supabase/migrations.
-- - Do NOT configure tools to run both /migrations and /supabase/migrations to avoid double-application.
-- - See docs/DB_MIGRATIONS.md for details on the authoritative migration directory.

-- add vendor_settings, product_views, and marketplace_ads tables for marketplace V2

-- vendor_settings holds per-vendor configuration such as commission rates
CREATE TABLE IF NOT EXISTS vendor_settings (
    vendor_id uuid PRIMARY KEY REFERENCES vendors(id),
    commission_rate numeric DEFAULT 0.10,
    shipping_fee numeric DEFAULT 0,
    currency text DEFAULT 'USD',
    tags text[],
    updated_at timestamptz NOT NULL DEFAULT now()
);

-- each product view is recorded for analytics and targeting
CREATE TABLE IF NOT EXISTS product_views (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    user_id uuid REFERENCES auth.users(id),
    viewed_at timestamptz NOT NULL DEFAULT now()
);

-- marketplace ads for vendors to bid/promote products or campaign
CREATE TABLE IF NOT EXISTS marketplace_ads (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    vendor_id uuid NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
    product_id uuid REFERENCES products(id) ON DELETE SET NULL,
    start_at timestamptz NOT NULL,
    end_at timestamptz NOT NULL,
    budget numeric NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
);

-- RLS: vendors can see their own settings and ads
ALTER TABLE vendor_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_views ENABLE ROW LEVEL SECURITY;
ALTER TABLE marketplace_ads ENABLE ROW LEVEL SECURITY;

-- policies for vendor_settings
CREATE POLICY "vendor settings owner" ON vendor_settings
    FOR ALL
    USING (vendor_id = auth.uid())
    WITH CHECK (vendor_id = auth.uid());

-- policies for product_views: allow insert by any authenticated user, select only for own views or vendor of product
CREATE POLICY "insert product view" ON product_views
    FOR INSERT
    WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "select product view" ON product_views
    FOR SELECT
    USING (
        user_id = auth.uid()
        OR EXISTS (
            SELECT 1 FROM products p
            JOIN vendors v ON v.id = p.vendor_id
            WHERE p.id = product_views.product_id
              AND v.user_id = auth.uid()
        )
    );

-- policies for marketplace_ads
CREATE POLICY "ads owner" ON marketplace_ads
    FOR ALL
    USING (vendor_id = (SELECT id FROM vendors WHERE user_id = auth.uid()))
    WITH CHECK (vendor_id = (SELECT id FROM vendors WHERE user_id = auth.uid()));

-- triggers for analytics or auctions could be added later

