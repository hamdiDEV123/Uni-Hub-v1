-- Campus Feed Phase 1.1
-- Adds downvotes + unified voting RPC for Hot/New feed behavior

ALTER TABLE public.campus_posts
  ADD COLUMN IF NOT EXISTS downvotes_count integer NOT NULL DEFAULT 0;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'campus_post_interactions_interaction_type_check'
      AND conrelid = 'public.campus_post_interactions'::regclass
  ) THEN
    ALTER TABLE public.campus_post_interactions
      DROP CONSTRAINT campus_post_interactions_interaction_type_check;
  END IF;
END;
$$;

ALTER TABLE public.campus_post_interactions
  ADD CONSTRAINT campus_post_interactions_interaction_type_check
  CHECK (interaction_type IN ('upvote', 'downvote'));

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'campus_post_interactions_post_id_user_id_interaction_type_key'
      AND conrelid = 'public.campus_post_interactions'::regclass
  ) THEN
    ALTER TABLE public.campus_post_interactions
      DROP CONSTRAINT campus_post_interactions_post_id_user_id_interaction_type_key;
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'campus_post_interactions_post_user_unique'
      AND conrelid = 'public.campus_post_interactions'::regclass
  ) THEN
    ALTER TABLE public.campus_post_interactions
      ADD CONSTRAINT campus_post_interactions_post_user_unique UNIQUE (post_id, user_id);
  END IF;
END;
$$;

DROP POLICY IF EXISTS "campus interactions insert own" ON public.campus_post_interactions;
CREATE POLICY "campus interactions insert own"
  ON public.campus_post_interactions
  FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND interaction_type IN ('upvote', 'downvote')
    AND EXISTS (
      SELECT 1
      FROM public.campus_posts p
      WHERE p.id = campus_post_interactions.post_id
        AND (
          p.post_type <> 'story'
          OR p.expires_at > now()
          OR p.author_id = auth.uid()
          OR public.has_role(auth.uid(), 'admin')
        )
    )
  );

CREATE OR REPLACE FUNCTION public.refresh_campus_post_counters(_post_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  UPDATE public.campus_posts p
  SET
    upvotes_count = COALESCE((
      SELECT COUNT(*)::integer
      FROM public.campus_post_interactions i
      WHERE i.post_id = _post_id
        AND i.interaction_type = 'upvote'
    ), 0),
    downvotes_count = COALESCE((
      SELECT COUNT(*)::integer
      FROM public.campus_post_interactions i
      WHERE i.post_id = _post_id
        AND i.interaction_type = 'downvote'
    ), 0),
    comments_count = COALESCE((
      SELECT COUNT(*)::integer
      FROM public.campus_post_comments c
      WHERE c.post_id = _post_id
    ), 0),
    updated_at = now()
  WHERE p.id = _post_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.vote_campus_post(_post_id uuid, _vote integer)
RETURNS TABLE (upvotes_count integer, downvotes_count integer, user_vote integer)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_uid uuid;
  v_exists boolean;
  v_current_vote integer;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'authentication required';
  END IF;

  IF _vote NOT IN (-1, 1) THEN
    RAISE EXCEPTION 'vote must be -1 or 1';
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.campus_posts p
    WHERE p.id = _post_id
      AND (
        p.post_type <> 'story'
        OR p.expires_at > now()
        OR p.author_id = v_uid
        OR public.has_role(v_uid, 'admin')
      )
  ) INTO v_exists;

  IF NOT COALESCE(v_exists, false) THEN
    RAISE EXCEPTION 'post not found or not visible';
  END IF;

  SELECT CASE WHEN i.interaction_type = 'upvote' THEN 1 ELSE -1 END
  INTO v_current_vote
  FROM public.campus_post_interactions i
  WHERE i.post_id = _post_id
    AND i.user_id = v_uid
  LIMIT 1;

  IF COALESCE(v_current_vote, 0) = _vote THEN
    DELETE FROM public.campus_post_interactions
    WHERE post_id = _post_id
      AND user_id = v_uid;

    v_current_vote := 0;
  ELSE
    INSERT INTO public.campus_post_interactions (post_id, user_id, interaction_type)
    VALUES (_post_id, v_uid, CASE WHEN _vote = 1 THEN 'upvote' ELSE 'downvote' END)
    ON CONFLICT (post_id, user_id)
    DO UPDATE SET
      interaction_type = EXCLUDED.interaction_type,
      created_at = now();

    v_current_vote := _vote;
  END IF;

  PERFORM public.refresh_campus_post_counters(_post_id);

  RETURN QUERY
  SELECT
    p.upvotes_count,
    p.downvotes_count,
    v_current_vote AS user_vote
  FROM public.campus_posts p
  WHERE p.id = _post_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.toggle_campus_post_upvote(_post_id uuid)
RETURNS TABLE (upvotes_count integer, user_has_upvoted boolean)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    v.upvotes_count,
    (v.user_vote = 1) AS user_has_upvoted
  FROM public.vote_campus_post(_post_id, 1) v;
END;
$$;

CREATE OR REPLACE FUNCTION public.guard_campus_posts_sensitive_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_is_admin boolean;
BEGIN
  v_is_admin := public.has_role(auth.uid(), 'admin');

  IF COALESCE(v_is_admin, false) THEN
    RETURN NEW;
  END IF;

  IF NEW.author_id IS DISTINCT FROM OLD.author_id THEN
    RAISE EXCEPTION 'author_id cannot be changed';
  END IF;

  IF NEW.upvotes_count IS DISTINCT FROM OLD.upvotes_count
     OR NEW.downvotes_count IS DISTINCT FROM OLD.downvotes_count
     OR NEW.comments_count IS DISTINCT FROM OLD.comments_count THEN
    RAISE EXCEPTION 'manual counters update is not allowed';
  END IF;

  IF NEW.is_pinned IS DISTINCT FROM OLD.is_pinned
     OR NEW.pinned_by IS DISTINCT FROM OLD.pinned_by
     OR NEW.pinned_at IS DISTINCT FROM OLD.pinned_at THEN
    RAISE EXCEPTION 'only admins can manage pinned state';
  END IF;

  IF NEW.post_type IS DISTINCT FROM OLD.post_type
     OR NEW.expires_at IS DISTINCT FROM OLD.expires_at THEN
    RAISE EXCEPTION 'post type and expiration cannot be changed';
  END IF;

  RETURN NEW;
END;
$$;

UPDATE public.campus_posts p
SET downvotes_count = COALESCE((
  SELECT COUNT(*)::integer
  FROM public.campus_post_interactions i
  WHERE i.post_id = p.id
    AND i.interaction_type = 'downvote'
), 0)
WHERE TRUE;

GRANT EXECUTE ON FUNCTION public.vote_campus_post(uuid, integer) TO authenticated;
