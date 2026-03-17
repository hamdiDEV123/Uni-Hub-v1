-- Campus Feed smoke checks (run as authenticated SQL session)
-- Purpose: quick verification after campus feed migration.

-- NOTE:
-- If you run this file from Supabase SQL Editor as postgres/service_role,
-- auth.uid() is NULL and authenticated-only RPCs will fail by design.
-- Use section (4) guarded block below, or set temporary JWT claims first.
--
-- Optional local auth simulation (replace <user_uuid>):
-- SELECT set_config('request.jwt.claim.role', 'authenticated', true);
-- SELECT set_config('request.jwt.claim.sub', '<user_uuid>', true);

-- 0) Baseline visibility
SELECT COUNT(*) AS posts_count FROM public.campus_posts;
SELECT COUNT(*) AS comments_count FROM public.campus_post_comments;
SELECT COUNT(*) AS interactions_count FROM public.campus_post_interactions;
SELECT COUNT(*) AS gamification_rows FROM public.user_gamification;

-- 1) Story expiry guard (thread should reject expires_at and story should require expires_at)
-- Expected: first insert fails, second insert succeeds.
/*
INSERT INTO public.campus_posts(author_id, post_type, category, content, expires_at)
VALUES (auth.uid(), 'thread', 'general', 'thread with invalid expiry', now() + interval '24 hours');

INSERT INTO public.campus_posts(author_id, post_type, category, content, expires_at)
VALUES (auth.uid(), 'story', 'general', 'story hello', now() + interval '24 hours');
*/

-- 2) Upvote toggle RPC check
-- Replace <post_uuid> with a real post id.
/*
SELECT * FROM public.toggle_campus_post_upvote('<post_uuid>'::uuid);
SELECT * FROM public.toggle_campus_post_upvote('<post_uuid>'::uuid); -- should remove vote
*/

-- 3) One verified answer per post guard (partial unique index)
-- Replace <post_uuid> with a real post id.
/*
INSERT INTO public.campus_post_comments(post_id, author_id, content)
VALUES ('<post_uuid>'::uuid, auth.uid(), 'Comment one');

UPDATE public.campus_post_comments
SET is_verified_answer = true, verified_by = auth.uid(), verified_at = now()
WHERE id = (
  SELECT id FROM public.campus_post_comments
  WHERE post_id = '<post_uuid>'::uuid
  ORDER BY created_at ASC
  LIMIT 1
);

INSERT INTO public.campus_post_comments(post_id, author_id, content)
VALUES ('<post_uuid>'::uuid, auth.uid(), 'Comment two');

UPDATE public.campus_post_comments
SET is_verified_answer = true, verified_by = auth.uid(), verified_at = now()
WHERE id = (
  SELECT id FROM public.campus_post_comments
  WHERE post_id = '<post_uuid>'::uuid
  ORDER BY created_at DESC
  LIMIT 1
); -- should fail unique index
*/

-- 4) Streak + karma quick check for current user
DO $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE NOTICE 'Skipping record_campus_activity: no authenticated JWT context in this SQL session.';
  ELSE
    PERFORM *
    FROM public.record_campus_activity(auth.uid(), 2);
  END IF;
END;
$$;

SELECT *
FROM public.user_gamification
WHERE user_id = auth.uid();
