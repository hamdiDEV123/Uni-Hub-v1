-- Study Hub smoke checks (run as authenticated SQL session)
-- Purpose: quick verification after migrations.

-- 0) Quick visibility checks
SELECT status, COUNT(*)
FROM public.study_materials
GROUP BY status
ORDER BY status;

SELECT COUNT(*) AS reports_count FROM public.study_material_reports;
SELECT COUNT(*) AS favorites_count FROM public.study_material_favorites;
SELECT COUNT(*) AS views_count FROM public.study_material_views;

-- 1) Duplicate guard check (same scope + same normalized URL should conflict)
-- NOTE: use your own authenticated user id for owner_id.
-- Expected: second insert fails with duplicate guard error.
/*
INSERT INTO public.study_materials (
  owner_id, university, faculty, study_year, term, course_name,
  material_type, title, description, resource_url
)
VALUES (
  auth.uid(), 'جامعة الدلتا', 'كلية الهندسة', 'الثالثة', 'الترم الأول', 'هياكل البيانات',
  'doctor_lecture', 'Data Structures - Lecture 1', 'sample', 'https://youtu.be/dQw4w9WgXcQ'
);

INSERT INTO public.study_materials (
  owner_id, university, faculty, study_year, term, course_name,
  material_type, title, description, resource_url
)
VALUES (
  auth.uid(), 'جامعة الدلتا', 'كلية الهندسة', 'الثالثة', 'الترم الأول', 'هياكل البيانات',
  'doctor_lecture', 'Duplicate test', 'sample', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ'
);
*/

-- 2) Voting RPC check (toggle behavior)
-- Replace <material_uuid> with a real material id.
/*
SELECT * FROM public.vote_study_material('<material_uuid>'::uuid, 1);
SELECT * FROM public.vote_study_material('<material_uuid>'::uuid, 1); -- should remove vote
SELECT * FROM public.vote_study_material('<material_uuid>'::uuid, -1);
*/

-- 3) Report uniqueness check (same user cannot report same material twice)
-- Replace <material_uuid> with a real material id.
/*
INSERT INTO public.study_material_reports(material_id, reporter_id, reason)
VALUES ('<material_uuid>'::uuid, auth.uid(), 'spam');

INSERT INTO public.study_material_reports(material_id, reporter_id, reason)
VALUES ('<material_uuid>'::uuid, auth.uid(), 'duplicate'); -- should fail unique
*/

-- 4) Favorites uniqueness check
-- Replace <material_uuid> with a real material id.
/*
INSERT INTO public.study_material_favorites(material_id, user_id)
VALUES ('<material_uuid>'::uuid, auth.uid());

INSERT INTO public.study_material_favorites(material_id, user_id)
VALUES ('<material_uuid>'::uuid, auth.uid()); -- should fail unique
*/

-- 5) Recent views upsert check
-- Replace <material_uuid> with a real material id.
/*
INSERT INTO public.study_material_views(material_id, user_id, viewed_at)
VALUES ('<material_uuid>'::uuid, auth.uid(), now())
ON CONFLICT (material_id, user_id)
DO UPDATE SET viewed_at = excluded.viewed_at;
*/
