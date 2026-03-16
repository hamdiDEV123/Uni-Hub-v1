BEGIN;

-- Enforce RLS strictly on critical tables
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wallet_ledger ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.orders FORCE ROW LEVEL SECURITY;
ALTER TABLE public.products FORCE ROW LEVEL SECURITY;
ALTER TABLE public.profiles FORCE ROW LEVEL SECURITY;
ALTER TABLE public.wallet_ledger FORCE ROW LEVEL SECURITY;

DO $$
DECLARE
  r RECORD;
BEGIN
  -- Drop any unexpected policies on orders
  FOR r IN
    SELECT policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'orders'
      AND policyname NOT IN ('orders_select_related_or_admin')
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.orders;', r.policyname);
  END LOOP;

  -- Drop any unexpected policies on products
  FOR r IN
    SELECT policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'products'
      AND policyname NOT IN (
        'products_select_active_or_owner_or_admin',
        'products_insert_seller_pending_only',
        'products_update_admin_only',
        'products_delete_admin_only'
      )
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.products;', r.policyname);
  END LOOP;

  -- Drop any unexpected policies on profiles
  FOR r IN
    SELECT policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'profiles'
      AND policyname NOT IN (
        'profiles_select_self_or_admin',
        'profiles_insert_self',
        'profiles_update_self_or_admin'
      )
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.profiles;', r.policyname);
  END LOOP;

  -- Drop any unexpected policies on wallet_ledger
  FOR r IN
    SELECT policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'wallet_ledger'
      AND policyname NOT IN (
        'wallet_ledger_select_self_or_admin',
        'wallet_ledger_insert_admin_only'
      )
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.wallet_ledger;', r.policyname);
  END LOOP;
END
$$;

COMMIT;
