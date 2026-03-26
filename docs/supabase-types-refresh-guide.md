# Supabase Types Refresh Guide

This guide refreshes `src/integrations/supabase/types.ts` safely, then validates the app before removing `as never` casts.

## Why this matters

- Keeps table/RPC typings in sync with the live schema.
- Reduces `as never` workarounds.
- Catches type issues earlier in CI/local checks.

## Safe workflow (recommended)

1. Create a dedicated branch.
2. Generate new Supabase types.
3. Run validation (`typecheck`, tests, build).
4. Remove `as never` gradually (small PRs).

## One-time setup

Use project-local CLI via `npx`:

```powershell
npm.cmd install
npx supabase login
npx supabase link --project-ref <YOUR_PROJECT_REF>
```

## Generate + validate

```powershell
npm.cmd run supabase:types:gen
npm.cmd run typecheck
npm.cmd run test -- --run
npm.cmd run build
```

Or run all at once:

```powershell
npm.cmd run supabase:types:refresh
```

## Track remaining `as never`

```powershell
npm.cmd run as-never:report
```

To fail CI when any `as never` remains in target folders:

```powershell
npm.cmd run as-never:fail
```

## Notes

- Refreshing generated types does **not** modify database data.
- If new type errors appear, they usually indicate previously hidden mismatches.
- Prefer removing casts in backend APIs first (`src/backend/**`), then pages/components.
