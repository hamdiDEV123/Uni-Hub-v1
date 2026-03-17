# Profile & Dashboard Rollout (March 17, 2026)

## What changed

- Added profile onboarding fields migration:
  - `supabase/migrations/20260317052000_profile_onboarding_fields_v1.sql`
- Dashboard now includes post-login student-context onboarding.
- Profile route now uses `src/pages/ProfileV2.tsx` with:
  - Avatar + cover uploads
  - Editable student context and basic profile data
  - Optional verification status section

## DB rollout

1. Apply migrations in order (including new migration):
   - `20260317052000_profile_onboarding_fields_v1.sql`
2. Refresh generated Supabase types in local environments.

## Smoke checks

1. Sign up/login with a fresh account.
2. Open `/dashboard` and verify onboarding card appears.
3. Fill university/faculty/study year and save.
4. Verify success toast and onboarding card disappears.
5. Open `/profile` and verify fields are prefilled.
6. Upload avatar and cover; verify visible after save/reload.

## Rollback

- Frontend rollback:
  - Revert `src/pages/DashboardHome.tsx`
  - Revert `src/pages/ProfileV2.tsx`
  - Revert `src/App.tsx` profile route import
- DB rollback (manual SQL):
  - Keep columns if data already used, but disable onboarding by default:
    - `UPDATE public.profiles SET onboarding_completed = true WHERE onboarding_completed = false;`
  - If strictly needed in non-production sandbox only:
    - drop added indexes/constraints/columns from migration.

## Notes

- University card upload remains optional and separate from basic onboarding.
- Student context is used to make feed/study-hub experiences more relevant.
