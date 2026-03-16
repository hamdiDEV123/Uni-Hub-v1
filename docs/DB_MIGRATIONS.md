## Database Migrations – UniHub Connect

This document explains how database migrations are organized for **UniHub Connect**, with a focus on:

- Which directory is the **authoritative** migration path
- Marketplace migration **timeline**
- **Source-of-truth** mapping for key RPCs
- Which migrations are **safe** vs **unsafe** to re-run

> This is documentation only. It does **not** change any SQL logic or behavior.

---

### 1. Authoritative migration directory

- **Official production / Supabase path**: `supabase/migrations`
  - All migrations managed by Supabase CLI and deployment tooling MUST come from this directory.
- **Non-authoritative / historical path**: `migrations/`
  - Contains copies or experimental SQL used during development.
  - MUST NOT be wired into Supabase CLI or production migration runners.
  - Example: `migrations/20260316_marketplace_ad_views_schema.sql` is a copy of the ad-views/vendor-settings migration and should be treated as a **development artifact only**.

**Rule:** Any change to schema / RPCs / RLS must be expressed as a new migration in `supabase/migrations`.

---

### 2. Marketplace migration timeline (high level)

This is not a complete list of every migration, but the key ones for marketplace behavior and security.

- `20260305220000_security_hardening_v1.sql`
  - Introduces helpers: `public.is_admin`, `public.current_uid`.
  - Tightens RLS for `profiles`, `wallet_ledger`, `products`, `orders`.
  - Adds secure delivery RPCs like `create_delivery_order_secure`.
  - If this folder exists, treat it as **development artifacts only** (not a deployment source).
- `20260305231000_marketplace_secure_cart_listing_rpc_v1.sql`
  - Enables and hardens RLS on `public.market_cart_items`.
  - Adds unique index on `(user_id, product_id)`.
  - Introduces **v1** of marketplace RPCs:
    - `public.add_market_cart_item_secure(...)` – secure cart add, writes into `market_cart_items`.
    - `public.create_market_product_listing_secure(...)` – v1 product listing RPC (no `vendor_id`).

- `20260312_p0_critical_fixes.sql`
  - Marked as a **P0 hotfix**.
  - Adds:
    - Enum types (idempotent).
    - `deleted_at` soft-delete columns (idempotent via `ADD COLUMN IF NOT EXISTS`).
    - `public.rate_limits` table + `public.check_rate_limit(...)` + `public.cleanup_rate_limits()`.
  - Also contains **historical / incomplete** drafts of some RPCs:
    - `add_market_cart_item_secure`
    - `create_market_checkout_order`
    - `create_market_product_listing_secure`
  - These drafts were intended to wire in rate limiting but do **not** contain the full original business logic. They are **not** the canonical implementations.

- `20260314_marketplace_v2_product_rpc.sql`
  - Defines the **v2** implementation of:
    - `public.create_market_product_listing_secure(...)`
  - Enhancements:
    - Integrates with `public.vendors` and sets `vendor_id` on `public.products`.
    - Auto-creates a casual vendor entry if needed.
    - Applies rate limiting by calling `public.check_rate_limit('product_create', 10, 1440)`.
  - This migration explicitly builds on:
    - Rate limiting primitives from `20260312_p0_critical_fixes.sql`.
    - Security / RLS hardening from earlier marketplace migrations.

> Other marketplace-related migrations (e.g., `marketplace_tiers_policy_v1`, `marketplace_v2_schema`, ad views schema, etc.) provide additional schema and behavior, but the key RPC evolution is summarized above.

---

### 2.1 Study Hub launch hardening (high level)

- `20260316120000_study_hub_phase1.sql`
  - Base Study Hub tables (`study_materials`, `study_material_votes`) + vote RPC + initial RLS.
- `20260316150000_study_hub_moderation_reports.sql`
  - Adds moderation status (`active`, `under_review`, `removed`) and reports table.
  - Extends update policy to owner-or-admin.
- `20260316163000_study_hub_duplicate_link_guard.sql`
  - Adds normalized URL scope guard via trigger to block duplicate links in same academic scope.
- `20260316173000_study_hub_favorites.sql` and `20260316190000_study_hub_recent_views.sql`
  - Adds favorites and recent-views tables with owner-scoped RLS policies.
- `20260316203000_study_hub_security_hardening.sql`
  - Adds admin-only delete policy on `study_material_reports`.
  - Adds update-guard trigger that prevents non-admin users from changing moderation/ranking-sensitive fields.

---

### 3. RPC source-of-truth mapping

This section maps important RPCs to the migration file that currently defines their **authoritative** implementation.

> Always update these RPCs by creating a **new** migration that uses `CREATE OR REPLACE FUNCTION`. Do **not** re-run older migrations to “restore” behavior.

- **`public.create_market_product_listing_secure(...)`**
  - **Source of truth**: `supabase/migrations/20260314_marketplace_v2_product_rpc.sql`
  - Earlier definitions:
    - v1 implementation in `supabase/migrations/20260305231000_marketplace_secure_cart_listing_rpc_v1.sql`
    - Historical / incomplete draft in `supabase/migrations/20260312_p0_critical_fixes.sql`
  - Notes:
    - v2 uses `check_rate_limit('product_create', ...)` from `20260312_p0_critical_fixes.sql`.
    - v2 attaches `vendor_id` and auto-creates vendor records when necessary.

- **`public.add_market_cart_item_secure(_product_id UUID, _quantity INTEGER DEFAULT 1)`**
  - **Source of truth**: `supabase/migrations/20260305231000_marketplace_secure_cart_listing_rpc_v1.sql`
  - Earlier / conflicting drafts:
    - A simplified / placeholder version exists in `supabase/migrations/20260312_p0_critical_fixes.sql` that **does not** write into `market_cart_items`; it should be considered **historical only**.
  - Notes:
    - The authoritative implementation:
      - Locks the product row.
      - Enforces availability / ownership checks.
      - Inserts or updates `public.market_cart_items` and returns the resulting quantity.

- **`public.create_market_checkout_order(_product_id UUID)`**
  - **Source of truth**: `supabase/migrations/20260215200000_marketplace_tiers_policy_v1.sql`
    - This version uses the **tier policy matrix** and `market_fee_settings` to compute commission and service fees.
  - Earlier version:
    - `supabase/migrations/20260215131000_marketplace_checkout_rpc.sql` contained a simpler commission scheme.
  - Historical draft:
    - `supabase/migrations/20260312_p0_critical_fixes.sql` includes a stub that wires in rate limiting via `check_rate_limit('order_create', ...)` but does **not** include the full original body (it has a placeholder `-- ... rest of existing function logic ...`). This stub should **never** overwrite the full implementation from `20260215200000_marketplace_tiers_policy_v1.sql`.

If you introduce new versions of these RPCs, append them as new migrations in `supabase/migrations` and update this mapping.

---

### 4. Safe vs unsafe migration re-execution

In a production-like Supabase setup, re-running migrations manually from the SQL editor or CLI can be dangerous if not clearly documented.

#### 4.1. Generally safe to re-run (still use judgment)

These statements are **idempotent by design** in this codebase and are usually safe to reapply:

- `CREATE TABLE IF NOT EXISTS ...`
- `ALTER TABLE ... ADD COLUMN IF NOT EXISTS ...`
- `CREATE TYPE IF NOT EXISTS ...`
- `CREATE INDEX IF NOT EXISTS ...`
- Simple `INSERT ... ON CONFLICT DO NOTHING` seeds

Re-running them may be useful when bootstrapping a new environment from scratch.

#### 4.2. High risk to re-run without review

The following statements can silently override newer logic or policies if re-applied from old migrations:

- `CREATE OR REPLACE FUNCTION ...`
  - This will replace the body of an existing RPC, even if a newer version exists in a later migration.
  - Example: re-running the RPC drafts in `20260312_p0_critical_fixes.sql` would overwrite the full implementations with incomplete ones.

- `DROP POLICY ...` / `CREATE POLICY ...`
  - Older migrations may contain less strict RLS rules than later hardening migrations.
  - Re-running them can unintentionally weaken security or diverge from what the application code expects.

- Any P0 / hotfix migration that mixes schema + logic + RLS + RPCs in a single file.
  - Example: `20260312_p0_critical_fixes.sql`.

**Rule of thumb:**  
If a migration contains **business logic** (RPC bodies) or **security rules** (RLS policies), treat it as **write-once**. Do not re-run it on production without a full code review and understanding of all migrations that came after it.

---

### 5. Guidelines for future changes

To keep the system stable and auditable as it evolves:

- **Always add, never rewrite history**
  - Use new migration files in `supabase/migrations` instead of editing old ones.
  - Use `CREATE OR REPLACE FUNCTION` in new files to evolve RPCs.

- **Keep docs and comments in sync**
  - When a new version of a critical RPC is introduced:
    - Add a short comment in the new migration stating it is the new source-of-truth.
    - Update the mapping in `docs/DB_MIGRATIONS.md`.

- **Avoid manual “fixes” by re-running old SQL**
  - If something breaks in production, create a targeted new migration rather than reapplying an old one from the SQL editor.
  - Refer back to this document to see which migrations are safe to re-run.

This approach is part of the broader **Production Hardening** mindset applied to UniHub Connect: small, explicit, forward-only changes with clear documentation of how the database and RPC layer evolved over time.

