## Study Hub Go-Live Checklist (P0)

Use this checklist to launch Study Hub safely for real users.

### 1) Apply required migrations (in order)

Run all pending files in `supabase/migrations`, especially:

- `20260316120000_study_hub_phase1.sql`
- `20260316133000_study_hub_add_university.sql`
- `20260316150000_study_hub_moderation_reports.sql`
- `20260316163000_study_hub_duplicate_link_guard.sql`
- `20260316173000_study_hub_favorites.sql`
- `20260316190000_study_hub_recent_views.sql`
- `20260316203000_study_hub_security_hardening.sql`

### 2) Verify security behavior (must pass)

- Student can create only with own `owner_id`.
- Student can edit only own material (title/description/resource link).
- Student cannot update `status`, `upvotes`, `downvotes`, or ownership/scope fields.
- Admin can set material status (`active`, `under_review`, `removed`).
- Admin can delete rows from `study_material_reports` (clear reports).

### 3) User smoke test (5–10 minutes)

- Add a valid material link.
- Try adding the same link in same scope (duplicate must fail).
- Upvote and remove vote toggle works.
- Add/remove favorite works.
- Open resource and verify recent views updates.
- Submit report once; duplicate report by same user should fail.

### 4) Admin smoke test (5–10 minutes)

In `/admin/study-hub`:

- Open reported queue.
- Filter by status and search by title/course/university.
- Set item to `under_review`, then `removed`, then back to `active`.
- Clear reports and confirm queue/count refresh.

### 5) Release gate

Go live only if:

- All migration scripts executed successfully.
- No TypeScript errors (`npm run typecheck`).
- Security and smoke checks pass.
