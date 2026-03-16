-- Marketplace v2 schema enhancements
-- Introduce vendors, vendor settings, and view/ad tracking.
-- Run in Supabase SQL Editor as part of a migration series.

-- 1. new vendors table (represents any seller: casual, pro student, big brand, external shop)
CREATE TABLE IF NOT EXISTS public.vendors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('casual','student_pro','big_brand','external')),
  shop_name TEXT,
  logo_url TEXT,
  verified BOOLEAN NOT NULL DEFAULT FALSE,
  campus_id UUID, -- for multi‑campus support, can be null for global
  subscription_status TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- index for lookup by user
CREATE INDEX IF NOT EXISTS idx_vendors_user_id ON public.vendors(user_id);

-- 2. vendor settings table (optional per-vendor overrides)
CREATE TABLE IF NOT EXISTS public.vendor_settings (
  vendor_id UUID PRIMARY KEY REFERENCES public.vendors(id) ON DELETE CASCADE,
  commission_rate NUMERIC DEFAULT 0.10,
  shipping_fee NUMERIC DEFAULT 0,
  currency TEXT DEFAULT 'EGP',
  tags TEXT[],
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. add vendor_id to products; existing rows assume casual/student (vendor created later)
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS vendor_id UUID REFERENCES public.vendors(id);

-- maintain an index for vendor filtering
CREATE INDEX IF NOT EXISTS idx_products_vendor_id ON public.products(vendor_id);

-- 4. product views tracking (analysis)
CREATE TABLE IF NOT EXISTS public.product_views (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  user_id UUID NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  viewed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_product_views_product_id ON public.product_views(product_id);
CREATE INDEX IF NOT EXISTS idx_product_views_user_id ON public.product_views(user_id);

-- 5. ads table (sponsored listings)
CREATE TABLE IF NOT EXISTS public.marketplace_ads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id UUID NOT NULL REFERENCES public.vendors(id) ON DELETE CASCADE,
  product_id UUID NULL REFERENCES public.products(id) ON DELETE SET NULL,
  start_at TIMESTAMPTZ NOT NULL,
  end_at TIMESTAMPTZ NOT NULL,
  budget NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ads_vendor_id ON public.marketplace_ads(vendor_id);
CREATE INDEX IF NOT EXISTS idx_ads_product_id ON public.marketplace_ads(product_id);

-- 6. RLS policies updates: ensure vendors see only their own records and
-- customers see only approved/active products.

-- products policy already exists; extend to enforce vendor_id readability
DROP POLICY IF EXISTS "Anyone can view products" ON public.products;
CREATE POLICY "Anyone can view products" ON public.products FOR SELECT TO authenticated
USING (
  listing_status = 'active'
  AND moderation_status = 'approved'
  AND (vendor_id IS NULL OR vendor_id IN (SELECT id FROM public.vendors WHERE verified = TRUE))
);

-- vendors can manage their own products
DROP POLICY IF EXISTS "Users can manage own products" ON public.products;
CREATE POLICY "Users can manage own products" ON public.products FOR ALL TO authenticated
USING (
  vendor_id = (SELECT id FROM public.vendors WHERE user_id = auth.uid())
)
WITH CHECK (
  vendor_id = (SELECT id FROM public.vendors WHERE user_id = auth.uid())
);

-- vendors table RLS
ALTER TABLE public.vendors ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Vendors can see themselves" ON public.vendors;
CREATE POLICY "Vendors can see themselves" ON public.vendors FOR SELECT TO authenticated
USING (
  user_id = auth.uid()
);

-- administrators (users with role 'admin') should have rights
-- (assuming has_role function exists)
ALTER POLICY "Vendors can see themselves" ON public.vendors
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

-- 7. Trigger to keep updated_at on vendors and vendor_settings
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_vendors_updated_at ON public.vendors;
CREATE TRIGGER trg_vendors_updated_at
  BEFORE UPDATE ON public.vendors
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

DROP TRIGGER IF EXISTS trg_vendor_settings_updated_at ON public.vendor_settings;
CREATE TRIGGER trg_vendor_settings_updated_at
  BEFORE UPDATE ON public.vendor_settings
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- end migration
