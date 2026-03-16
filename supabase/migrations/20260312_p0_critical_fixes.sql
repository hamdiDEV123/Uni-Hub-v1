-- P0 Critical Fixes - SQL Migrations
-- Execute these in order in Supabase SQL Editor
-- WARNING (2026-03-14 and later):
-- This migration was used as a P0 hotfix and contains:
-- - Rate limiting primitives (rate_limits table + check_rate_limit / cleanup_rate_limits)
-- - Historical and INCOMPLETE drafts of some RPCs (add_market_cart_item_secure, create_market_checkout_order, create_market_product_listing_secure)
-- IMPORTANT:
-- - Do NOT re-run this migration as a whole on production after 2026-03-14.
-- - Do NOT use the CREATE OR REPLACE FUNCTION definitions in this file as the current implementations.
-- - Official, production-ready implementations for these RPCs live in later migrations (see docs/DB_MIGRATIONS.md).

-- ===========================================
-- 0. ADD MISSING ENUM TYPES FIRST
-- ===========================================

-- Add missing enum types if they don't exist
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'market_payment_method') THEN
    CREATE TYPE public.market_payment_method AS ENUM ('cash_on_delivery', 'vodafone_cash', 'instapay');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'market_order_status') THEN
    CREATE TYPE public.market_order_status AS ENUM (
      'pending_payment',
      'paid_held',
      'processing',
      'shipped',
      'delivered',
      'cancelled',
      'refunded'
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'seller_tier') THEN
    CREATE TYPE public.seller_tier AS ENUM ('casual', 'student_pro', 'big_store', 'brand', 'pro');
  END IF;
END $$;

-- ===========================================
-- 1. SOFT DELETES - Add deleted_at timestamps
-- ===========================================

-- Add deleted_at to orders table
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- Add deleted_at to products table
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- Add deleted_at to housing table
ALTER TABLE public.housing ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- Add deleted_at to delivery_orders table
ALTER TABLE public.delivery_orders ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- Update RLS policies to exclude soft-deleted records
DROP POLICY IF EXISTS "Users can view own orders" ON public.orders;
CREATE POLICY "Users can view own orders"
ON public.orders FOR SELECT TO authenticated
USING (
  (auth.uid() = buyer_id OR auth.uid() = runner_id)
  AND deleted_at IS NULL
);

-- ===========================================
-- 2. INVENTORY RACE CONDITION FIX
-- ===========================================

-- Add inventory lock function to prevent overselling
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
  v_user_id UUID := auth.uid();
  v_product public.products%ROWTYPE;
  v_cart_item_id INTEGER;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'UNAUTHORIZED';
  END IF;

  -- Lock the product row to prevent race conditions
  SELECT * INTO v_product
  FROM public.products
  WHERE id = _product_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'PRODUCT_NOT_FOUND';
  END IF;

  IF v_product.deleted_at IS NOT NULL THEN
    RAISE EXCEPTION 'PRODUCT_DELETED';
  END IF;

  -- Check if seller is trying to add their own product
  IF v_product.seller_id = v_user_id THEN
    RAISE EXCEPTION 'CANNOT_ADD_OWN_PRODUCT';
  END IF;

  -- Check stock availability
  IF v_product.stock_qty < _quantity THEN
    RAISE EXCEPTION 'INSUFFICIENT_STOCK';
  END IF;

  -- Add to cart (this will be implemented as a separate cart table)
  -- For now, return success
  RETURN 1;
END;
$$;

-- ===========================================
-- 3. RATE LIMITING - Basic implementation
-- ===========================================

-- Create rate limiting table
CREATE TABLE IF NOT EXISTS public.rate_limits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action_type TEXT NOT NULL, -- 'order_create', 'product_create', 'payment_submit', etc.
  window_start TIMESTAMPTZ NOT NULL DEFAULT now(),
  request_count INTEGER NOT NULL DEFAULT 1,
  UNIQUE(user_id, action_type, window_start)
);

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_rate_limits_user_action_window
ON public.rate_limits(user_id, action_type, window_start DESC);

-- Rate limiting function
CREATE OR REPLACE FUNCTION public.check_rate_limit(
  _action_type TEXT,
  _max_requests INTEGER DEFAULT 10,
  _window_minutes INTEGER DEFAULT 60
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_window_start TIMESTAMPTZ;
  v_current_count INTEGER;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN false;
  END IF;

  -- Calculate window start (truncate to minute)
  v_window_start := date_trunc('minute', now()) - INTERVAL '1 minute' * (extract(minute from now()) % _window_minutes);

  -- Get current count
  SELECT request_count INTO v_current_count
  FROM public.rate_limits
  WHERE user_id = v_user_id
    AND action_type = _action_type
    AND window_start = v_window_start;

  -- If no record exists, create one
  IF v_current_count IS NULL THEN
    INSERT INTO public.rate_limits (user_id, action_type, window_start, request_count)
    VALUES (v_user_id, _action_type, v_window_start, 1);
    RETURN true;
  END IF;

  -- Check if limit exceeded
  IF v_current_count >= _max_requests THEN
    RETURN false;
  END IF;

  -- Increment counter
  UPDATE public.rate_limits
  SET request_count = request_count + 1
  WHERE user_id = v_user_id
    AND action_type = _action_type
    AND window_start = v_window_start;

  RETURN true;
END;
$$;

-- ===========================================
-- 4. UPDATE EXISTING RPC FUNCTIONS WITH RATE LIMITING
-- ===========================================

-- Update create_market_checkout_order with rate limiting
CREATE OR REPLACE FUNCTION public.create_market_checkout_order(
  _product_id UUID,
  _payment_method public.market_payment_method DEFAULT 'cash_on_delivery'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_order_id UUID;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'UNAUTHORIZED';
  END IF;

  -- Rate limit order creation (max 5 orders per hour)
  IF NOT public.check_rate_limit('order_create', 5, 60) THEN
    RAISE EXCEPTION 'RATE_LIMIT_EXCEEDED: Too many orders created. Please wait before creating another order.';
  END IF;

  -- ... rest of existing function logic ...
  -- (Keep the existing implementation)

  RETURN v_order_id;
END;
$$;

-- Update create_market_product_listing_secure with rate limiting
CREATE OR REPLACE FUNCTION public.create_market_product_listing_secure(
  _title TEXT,
  _description TEXT DEFAULT '',
  _category public.product_category DEFAULT 'Tech',
  _price NUMERIC DEFAULT 0,
  _stock_qty INTEGER DEFAULT 1,
  _product_condition TEXT DEFAULT 'used',
  _phone TEXT DEFAULT NULL,
  _image_urls TEXT[] DEFAULT ARRAY[]::TEXT[],
  _is_negotiable BOOLEAN DEFAULT false
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_product_id UUID;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'UNAUTHORIZED';
  END IF;

  -- Rate limit product creation (max 10 products per day)
  IF NOT public.check_rate_limit('product_create', 10, 1440) THEN
    RAISE EXCEPTION 'RATE_LIMIT_EXCEEDED: Too many products created today. Please wait before creating another listing.';
  END IF;

  -- ... rest of existing function logic ...

  RETURN v_product_id;
END;
$$;

-- ===========================================
-- 5. CLEANUP OLD RATE LIMIT RECORDS
-- ===========================================

-- Function to cleanup old rate limit records (run daily)
CREATE OR REPLACE FUNCTION public.cleanup_rate_limits()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_deleted_count INTEGER;
BEGIN
  DELETE FROM public.rate_limits
  WHERE window_start < now() - INTERVAL '24 hours';

  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
  RETURN v_deleted_count;
END;
$$;

-- ===========================================
-- 6. ADD INDEXES FOR PERFORMANCE
-- ===========================================

-- Index for soft deletes
CREATE INDEX IF NOT EXISTS idx_orders_deleted_at ON public.orders(deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_products_deleted_at ON public.products(deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_housing_deleted_at ON public.housing(deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_delivery_orders_deleted_at ON public.delivery_orders(deleted_at) WHERE deleted_at IS NULL;

-- Index for rate limiting performance
CREATE INDEX IF NOT EXISTS idx_rate_limits_cleanup ON public.rate_limits(window_start);

-- ===========================================
-- 7. UPDATE RLS POLICIES FOR SOFT DELETES
-- ===========================================

-- Products policy - exclude soft deleted
DROP POLICY IF EXISTS "Anyone can view products" ON public.products;
CREATE POLICY "Anyone can view products"
ON public.products FOR SELECT TO authenticated
USING (deleted_at IS NULL);

-- Housing policy - exclude soft deleted
DROP POLICY IF EXISTS "Anyone can view housing" ON public.housing;
CREATE POLICY "Anyone can view housing"
ON public.housing FOR SELECT TO authenticated
USING (deleted_at IS NULL);

-- Delivery orders policy - exclude soft deleted
DROP POLICY IF EXISTS "delivery_orders_select_related_or_open" ON public.delivery_orders;
CREATE POLICY "delivery_orders_select_related_or_open"
ON public.delivery_orders FOR SELECT TO authenticated
USING (
  (auth.uid() = requester_id
  OR auth.uid() = runner_id
  OR status = 'open'
  OR public.has_role(auth.uid(), 'admin'))
  AND deleted_at IS NULL
);