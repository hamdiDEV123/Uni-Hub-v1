-- Campus Feed Phase 5.0
-- Story reactions + streak activity hook

CREATE TABLE IF NOT EXISTS public.campus_story_reactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  story_post_id uuid NOT NULL REFERENCES public.campus_posts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  reaction_type text NOT NULL CHECK (reaction_type IN ('like', 'fire', 'laugh', 'clap', 'wow')),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT campus_story_reactions_story_user_unique UNIQUE (story_post_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_campus_story_reactions_story_type
  ON public.campus_story_reactions (story_post_id, reaction_type);

CREATE INDEX IF NOT EXISTS idx_campus_story_reactions_user_created
  ON public.campus_story_reactions (user_id, created_at DESC);

ALTER TABLE public.campus_story_reactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "campus story reactions select visible_stories" ON public.campus_story_reactions;
CREATE POLICY "campus story reactions select visible_stories"
  ON public.campus_story_reactions
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.campus_posts p
      WHERE p.id = campus_story_reactions.story_post_id
        AND p.post_type = 'story'
        AND (
          p.expires_at > now()
          OR p.author_id = auth.uid()
          OR public.has_role(auth.uid(), 'admin')
        )
    )
  );

DROP POLICY IF EXISTS "campus story reactions insert own" ON public.campus_story_reactions;
CREATE POLICY "campus story reactions insert own"
  ON public.campus_story_reactions
  FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.campus_posts p
      WHERE p.id = campus_story_reactions.story_post_id
        AND p.post_type = 'story'
        AND (
          p.expires_at > now()
          OR p.author_id = auth.uid()
          OR public.has_role(auth.uid(), 'admin')
        )
    )
  );

DROP POLICY IF EXISTS "campus story reactions delete own_or_admin" ON public.campus_story_reactions;
CREATE POLICY "campus story reactions delete own_or_admin"
  ON public.campus_story_reactions
  FOR DELETE
  TO authenticated
  USING (
    user_id = auth.uid()
    OR public.has_role(auth.uid(), 'admin')
  );

CREATE OR REPLACE FUNCTION public.react_to_campus_story(
  _story_post_id uuid,
  _reaction_type text
)
RETURNS TABLE (user_reaction_type text, total_reactions integer)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_uid uuid;
  v_current_reaction text;
  v_next_reaction text;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'authentication required';
  END IF;

  IF _reaction_type NOT IN ('like', 'fire', 'laugh', 'clap', 'wow') THEN
    RAISE EXCEPTION 'invalid reaction type';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.campus_posts p
    WHERE p.id = _story_post_id
      AND p.post_type = 'story'
      AND (
        p.expires_at > now()
        OR p.author_id = v_uid
        OR public.has_role(v_uid, 'admin')
      )
  ) THEN
    RAISE EXCEPTION 'story not found or not visible';
  END IF;

  SELECT r.reaction_type
  INTO v_current_reaction
  FROM public.campus_story_reactions r
  WHERE r.story_post_id = _story_post_id
    AND r.user_id = v_uid
  LIMIT 1;

  IF v_current_reaction = _reaction_type THEN
    DELETE FROM public.campus_story_reactions
    WHERE story_post_id = _story_post_id
      AND user_id = v_uid;

    v_next_reaction := NULL;
  ELSE
    DELETE FROM public.campus_story_reactions
    WHERE story_post_id = _story_post_id
      AND user_id = v_uid;

    INSERT INTO public.campus_story_reactions (story_post_id, user_id, reaction_type)
    VALUES (_story_post_id, v_uid, _reaction_type);

    v_next_reaction := _reaction_type;

    PERFORM public.record_campus_activity(v_uid, 1);
  END IF;

  RETURN QUERY
  SELECT
    v_next_reaction AS user_reaction_type,
    COALESCE((
      SELECT COUNT(*)::integer
      FROM public.campus_story_reactions r2
      WHERE r2.story_post_id = _story_post_id
    ), 0) AS total_reactions;
END;
$$;

GRANT EXECUTE ON FUNCTION public.react_to_campus_story(uuid, text) TO authenticated;
