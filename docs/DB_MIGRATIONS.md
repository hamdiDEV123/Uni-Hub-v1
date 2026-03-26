## Database Migrations – UniHub Connect

This document explains how database migrations are organized for **UniHub Connect**, with a focus on:

- Which directory is the **authoritative** migration path
- Marketplace migration **timeline**
- **Source-of-truth** mapping for key RPCs
- Which migrations are **safe** vs **unsafe** to re-run


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
    - `public.rate_limits` table + `public.check_rate_limit(...)` + `public.cleanup_rate_limits()`.
  - Also contains **historical / incomplete** drafts of some RPCs:
    - `add_market_cart_item_secure`
    - `create_market_product_listing_secure`

- `20260314_marketplace_v2_product_rpc.sql`
    - `public.create_market_product_listing_secure(...)`
    - Integrates with `public.vendors` and sets `vendor_id` on `public.products`.
    - Applies rate limiting by calling `public.check_rate_limit('product_create', 10, 1440)`.
  - This migration explicitly builds on:
    - Rate limiting primitives from `20260312_p0_critical_fixes.sql`.
    - Security / RLS hardening from earlier marketplace migrations.

- `20260316123000_marketplace_listing_modes_v3.sql`
  - Adds enum `public.market_listing_mode` (`sale`, `rental`, `barter`, `service`).
  - Adds product fields: `listing_mode`, `rental_price_per_day`, `barter_for`, `service_delivery_days`.
  - Introduces `public.create_market_product_listing_v3_secure(...)` for expanded listing flows.

- `20260317010000_restore_market_cart_add_rpc_v2.sql`
  - Restores `public.add_market_cart_item_secure(...)` to the full cart-writing implementation.
  - Fixes an accidental override introduced by the historical hotfix migration `20260312_p0_critical_fixes.sql`.


---

### 2.1 Study Hub launch hardening (high level)

- `20260316120000_study_hub_phase1.sql`
  - Base Study Hub tables (`study_materials`, `study_material_votes`) + vote RPC + initial RLS.
- `20260316150000_study_hub_moderation_reports.sql`
  - Adds moderation status (`active`, `under_review`, `removed`) and reports table.
  - Extends update policy to owner-or-admin.
- `20260316163000_study_hub_duplicate_link_guard.sql`
- `20260316173000_study_hub_favorites.sql` and `20260316190000_study_hub_recent_views.sql`
  - Adds favorites and recent-views tables with owner-scoped RLS policies.
- `20260316203000_study_hub_security_hardening.sql`
  - Adds update-guard trigger that prevents non-admin users from changing moderation/ranking-sensitive fields.

### 2.2 Campus Feed phase 1 (high level)
- `20260316220000_campus_feed_phase1.sql`
  - Introduces social foundation tables:
    - `campus_posts` (threads + stories with 24h expiry)
    - `campus_post_comments` (including verified-answer flags)
    - `campus_post_interactions` (upvotes)
  - Adds RLS for authenticated users with owner/admin controls and story visibility rules.
  - Adds RPCs and trigger helpers for:
    - upvote toggle (`toggle_campus_post_upvote`)
    - activity tracking (`record_campus_activity`) to maintain streak/karma.

- `20260317001000_campus_feed_votes_hot_new.sql`
  - Extends votes model with `downvotes_count` and per-user single vote state (`upvote`/`downvote`).

- `20260317004000_campus_feed_hashtags_trending.sql`
  - Adds `campus_post_hashtags` table and automatic hashtag sync trigger on `campus_posts`.
  - Adds trending RPC `fetch_campus_trending_hashtags(_hours, _limit)` for hot campus topics.

- `20260317013000_campus_feed_polls.sql`
  - Adds poll tables (`campus_post_polls`, `campus_post_poll_options`, `campus_post_poll_votes`) with RLS.
    - `create_campus_post_poll(_post_id, _question, _options)`
    - `vote_campus_poll(_post_id, _option_id)`

- `20260317020500_campus_threaded_comments.sql`
  - Adds `parent_comment_id` to `campus_post_comments` for threaded replies.
  - Adds parent validation trigger to enforce same-post replies and one-level nesting.

- `20260317024500_campus_story_reactions.sql`
  - Adds `react_to_campus_story(_story_post_id, _reaction_type)` RPC for quick emoji reactions.
  - Reaction inserts call `record_campus_activity(...)` to reinforce daily streak behavior.

### 2.3 Housing roommate matcher (high level)
- `20260316143000_housing_roommate_requests_v1.sql`
  - Adds `public.roommate_requests` table for roommate matcher posts.
  - Adds budget/schedule/smoking preference constraints and owner-scoped RLS.
  - Adds indexes on `created_at` and `user_id` for listing/feed performance.

---

### 3. RPC source-of-truth mapping

This section maps important RPCs to the migration file that currently defines their **authoritative** implementation.


- **`public.create_market_product_listing_secure(...)`**
  - **Source of truth**: `supabase/migrations/20260314_marketplace_v2_product_rpc.sql`
  - Earlier definitions:
    - v1 implementation in `supabase/migrations/20260305231000_marketplace_secure_cart_listing_rpc_v1.sql`
    - Historical / incomplete draft in `supabase/migrations/20260312_p0_critical_fixes.sql`
  - Notes:
    - v2 uses `check_rate_limit('product_create', ...)` from `20260312_p0_critical_fixes.sql`.
    - v2 attaches `vendor_id` and auto-creates vendor records when necessary.

- **`public.create_market_product_listing_v3_secure(...)`**
  - **Source of truth**: `supabase/migrations/20260316123000_marketplace_listing_modes_v3.sql`
  - Notes:
    - Adds listing mode aware validation for sale/rental/barter/service.
    - Stores mode-specific fields on `public.products` while keeping v2 RPC intact.
- **`public.add_market_cart_item_secure(_product_id UUID, _quantity INTEGER DEFAULT 1)`**
  - **Source of truth**: `supabase/migrations/20260317010000_restore_market_cart_add_rpc_v2.sql`
  - Earlier / conflicting drafts:
    - `supabase/migrations/20260305231000_marketplace_secure_cart_listing_rpc_v1.sql` (full implementation; now superseded by the restore migration).
    - A simplified / placeholder version exists in `supabase/migrations/20260312_p0_critical_fixes.sql` that **does not** write into `market_cart_items`; it should be considered **historical only**.
  - Notes:
    - The authoritative implementation:
      - Locks the product row.
      - Enforces availability / ownership checks.
      - Inserts or updates `public.market_cart_items` and returns the resulting quantity.
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

  - Example: `20260312_p0_critical_fixes.sql`.

**Rule of thumb:**  
If a migration contains **business logic** (RPC bodies) or **security rules** (RLS policies), treat it as **write-once**. Do not re-run it on production without a full code review and understanding of all migrations that came after it.

- `20260317041000_campus_post_counter_guard_internal_fix.sql`
  - Fixes blocked post counter refresh caused by guard trigger during internal vote/comment counter updates.
  - Allows trusted internal refresh path via transaction-local flag while keeping manual counter tampering blocked.

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

