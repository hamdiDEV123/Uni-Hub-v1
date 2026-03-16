-- Run this file in Supabase SQL Editor (single paste)
-- Generated automatically from project migrations.

BEGIN;
-- Delivery logistics core schema (backfilled migration)
-- This file replaces the accidental empty migration and is idempotent.

-- 1) Orders table for delivery workflows
CREATE TABLE IF NOT EXISTS public.delivery_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  runner_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT,
  pickup_location TEXT,
  dropoff_location TEXT,
  fee NUMERIC(10,2),
  status TEXT NOT NULL DEFAULT 'open',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_delivery_orders_status_created
ON public.delivery_orders(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_delivery_orders_requester
ON public.delivery_orders(requester_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_delivery_orders_runner
ON public.delivery_orders(runner_id, created_at DESC);

-- 2) Runner offers
CREATE TABLE IF NOT EXISTS public.delivery_offers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.delivery_orders(id) ON DELETE CASCADE,
  runner_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  note TEXT,
  amount NUMERIC(10,2),
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (order_id, runner_id)
);

CREATE INDEX IF NOT EXISTS idx_delivery_offers_order
ON public.delivery_offers(order_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_delivery_offers_runner
ON public.delivery_offers(runner_id, created_at DESC);

-- 3) Order chat messages
CREATE TABLE IF NOT EXISTS public.delivery_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.delivery_orders(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_delivery_messages_order_created
ON public.delivery_messages(order_id, created_at DESC);

-- 4) Tracking points
CREATE TABLE IF NOT EXISTS public.delivery_tracking_points (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.delivery_orders(id) ON DELETE CASCADE,
  runner_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_delivery_tracking_order_created
ON public.delivery_tracking_points(order_id, created_at DESC);

-- 5) Verification artifacts (pickup selfie / handoff evidence / etc)
CREATE TABLE IF NOT EXISTS public.delivery_verifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.delivery_orders(id) ON DELETE CASCADE,
  actor_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  media_url TEXT,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_delivery_verifications_order_created
ON public.delivery_verifications(order_id, created_at DESC);

-- 6) Keep updated_at maintained for mutable tables
CREATE OR REPLACE FUNCTION public.set_delivery_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'tr_delivery_orders_set_updated_at') THEN
    CREATE TRIGGER tr_delivery_orders_set_updated_at
    BEFORE UPDATE ON public.delivery_orders
    FOR EACH ROW
    EXECUTE FUNCTION public.set_delivery_updated_at();
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'tr_delivery_offers_set_updated_at') THEN
    CREATE TRIGGER tr_delivery_offers_set_updated_at
    BEFORE UPDATE ON public.delivery_offers
    FOR EACH ROW
    EXECUTE FUNCTION public.set_delivery_updated_at();
  END IF;
END $$;

-- 7) RLS baseline
ALTER TABLE public.delivery_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.delivery_offers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.delivery_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.delivery_tracking_points ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.delivery_verifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "delivery_orders_select_related_or_open" ON public.delivery_orders;
CREATE POLICY "delivery_orders_select_related_or_open"
ON public.delivery_orders
FOR SELECT TO authenticated
USING (auth.uid() = requester_id OR auth.uid() = runner_id OR status = 'open');

DROP POLICY IF EXISTS "delivery_orders_insert_requester_only" ON public.delivery_orders;
CREATE POLICY "delivery_orders_insert_requester_only"
ON public.delivery_orders
FOR INSERT TO authenticated
WITH CHECK (auth.uid() = requester_id);

DROP POLICY IF EXISTS "delivery_orders_update_related_users" ON public.delivery_orders;
CREATE POLICY "delivery_orders_update_related_users"
ON public.delivery_orders
FOR UPDATE TO authenticated
USING (auth.uid() = requester_id OR auth.uid() = runner_id)
WITH CHECK (auth.uid() = requester_id OR auth.uid() = runner_id);

DROP POLICY IF EXISTS "delivery_offers_select_related" ON public.delivery_offers;
CREATE POLICY "delivery_offers_select_related"
ON public.delivery_offers
FOR SELECT TO authenticated
USING (
  auth.uid() = runner_id OR EXISTS (
    SELECT 1
    FROM public.delivery_orders o
    WHERE o.id = order_id AND (o.requester_id = auth.uid() OR o.runner_id = auth.uid())
  )
);

DROP POLICY IF EXISTS "delivery_offers_insert_runner_only" ON public.delivery_offers;
CREATE POLICY "delivery_offers_insert_runner_only"
ON public.delivery_offers
FOR INSERT TO authenticated
WITH CHECK (
  auth.uid() = runner_id
  AND EXISTS (
    SELECT 1
    FROM public.delivery_orders o
    WHERE o.id = order_id AND o.status = 'open'
  )
);

DROP POLICY IF EXISTS "delivery_offers_update_runner_or_requester" ON public.delivery_offers;
CREATE POLICY "delivery_offers_update_runner_or_requester"
ON public.delivery_offers
FOR UPDATE TO authenticated
USING (
  auth.uid() = runner_id OR EXISTS (
    SELECT 1
    FROM public.delivery_orders o
    WHERE o.id = order_id AND o.requester_id = auth.uid()
  )
)
WITH CHECK (
  auth.uid() = runner_id OR EXISTS (
    SELECT 1
    FROM public.delivery_orders o
    WHERE o.id = order_id AND o.requester_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "delivery_messages_select_related" ON public.delivery_messages;
CREATE POLICY "delivery_messages_select_related"
ON public.delivery_messages
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.delivery_orders o
    WHERE o.id = order_id AND (o.requester_id = auth.uid() OR o.runner_id = auth.uid())
  )
);

DROP POLICY IF EXISTS "delivery_messages_insert_related" ON public.delivery_messages;
CREATE POLICY "delivery_messages_insert_related"
ON public.delivery_messages
FOR INSERT TO authenticated
WITH CHECK (
  auth.uid() = sender_id
  AND EXISTS (
    SELECT 1
    FROM public.delivery_orders o
    WHERE o.id = order_id AND (o.requester_id = auth.uid() OR o.runner_id = auth.uid())
  )
);

DROP POLICY IF EXISTS "delivery_tracking_select_related" ON public.delivery_tracking_points;
CREATE POLICY "delivery_tracking_select_related"
ON public.delivery_tracking_points
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.delivery_orders o
    WHERE o.id = order_id AND (o.requester_id = auth.uid() OR o.runner_id = auth.uid())
  )
);

DROP POLICY IF EXISTS "delivery_tracking_insert_runner_only" ON public.delivery_tracking_points;
CREATE POLICY "delivery_tracking_insert_runner_only"
ON public.delivery_tracking_points
FOR INSERT TO authenticated
WITH CHECK (
  auth.uid() = runner_id
  AND EXISTS (
    SELECT 1
    FROM public.delivery_orders o
    WHERE o.id = order_id AND o.runner_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "delivery_verifications_select_related" ON public.delivery_verifications;
CREATE POLICY "delivery_verifications_select_related"
ON public.delivery_verifications
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.delivery_orders o
    WHERE o.id = order_id AND (o.requester_id = auth.uid() OR o.runner_id = auth.uid())
  )
);

DROP POLICY IF EXISTS "delivery_verifications_insert_related_actor" ON public.delivery_verifications;
CREATE POLICY "delivery_verifications_insert_related_actor"
ON public.delivery_verifications
FOR INSERT TO authenticated
WITH CHECK (
  auth.uid() = actor_id
  AND EXISTS (
    SELECT 1
    FROM public.delivery_orders o
    WHERE o.id = order_id AND (o.requester_id = auth.uid() OR o.runner_id = auth.uid())
  )
);


-- Ensure product_images storage bucket and policies are present.
-- Idempotent migration.

INSERT INTO storage.buckets (id, name, public)
VALUES ('product_images', 'product_images', true)
ON CONFLICT (id) DO UPDATE
SET public = EXCLUDED.public;

DROP POLICY IF EXISTS "product_images_public_read" ON storage.objects;
CREATE POLICY "product_images_public_read"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'product_images');

DROP POLICY IF EXISTS "product_images_auth_upload_own_folder" ON storage.objects;
CREATE POLICY "product_images_auth_upload_own_folder"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'product_images'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

DROP POLICY IF EXISTS "product_images_auth_update_own_folder" ON storage.objects;
CREATE POLICY "product_images_auth_update_own_folder"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'product_images'
  AND auth.uid()::text = (storage.foldername(name))[1]
)
WITH CHECK (
  bucket_id = 'product_images'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

DROP POLICY IF EXISTS "product_images_auth_delete_own_folder" ON storage.objects;
CREATE POLICY "product_images_auth_delete_own_folder"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'product_images'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

COMMIT;
