-- Campus Feed Phase 3.0
-- Polls model + voting flow

CREATE TABLE IF NOT EXISTS public.campus_post_polls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL UNIQUE REFERENCES public.campus_posts(id) ON DELETE CASCADE,
  question text NOT NULL CHECK (NULLIF(BTRIM(question), '') IS NOT NULL),
  allow_multiple boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.campus_post_poll_options (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  poll_id uuid NOT NULL REFERENCES public.campus_post_polls(id) ON DELETE CASCADE,
  option_text text NOT NULL CHECK (NULLIF(BTRIM(option_text), '') IS NOT NULL),
  sort_order integer NOT NULL DEFAULT 0,
  votes_count integer NOT NULL DEFAULT 0 CHECK (votes_count >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT campus_post_poll_options_poll_sort_unique UNIQUE (poll_id, sort_order)
);

CREATE TABLE IF NOT EXISTS public.campus_post_poll_votes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  poll_id uuid NOT NULL REFERENCES public.campus_post_polls(id) ON DELETE CASCADE,
  option_id uuid NOT NULL REFERENCES public.campus_post_poll_options(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT campus_post_poll_votes_poll_user_unique UNIQUE (poll_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_campus_post_polls_post
  ON public.campus_post_polls (post_id);

CREATE INDEX IF NOT EXISTS idx_campus_post_poll_options_poll_sort
  ON public.campus_post_poll_options (poll_id, sort_order ASC);

CREATE INDEX IF NOT EXISTS idx_campus_post_poll_votes_poll
  ON public.campus_post_poll_votes (poll_id);

CREATE INDEX IF NOT EXISTS idx_campus_post_poll_votes_user
  ON public.campus_post_poll_votes (user_id, created_at DESC);

ALTER TABLE public.campus_post_polls ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campus_post_poll_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campus_post_poll_votes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "campus polls select visible_posts" ON public.campus_post_polls;
CREATE POLICY "campus polls select visible_posts"
  ON public.campus_post_polls
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.campus_posts p
      WHERE p.id = campus_post_polls.post_id
        AND (
          p.post_type <> 'story'
          OR p.expires_at > now()
          OR p.author_id = auth.uid()
          OR public.has_role(auth.uid(), 'admin')
        )
    )
  );

DROP POLICY IF EXISTS "campus polls insert own_or_admin" ON public.campus_post_polls;
CREATE POLICY "campus polls insert own_or_admin"
  ON public.campus_post_polls
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.campus_posts p
      WHERE p.id = campus_post_polls.post_id
        AND p.post_type = 'thread'
        AND (
          p.author_id = auth.uid()
          OR public.has_role(auth.uid(), 'admin')
        )
    )
  );

DROP POLICY IF EXISTS "campus polls delete own_or_admin" ON public.campus_post_polls;
CREATE POLICY "campus polls delete own_or_admin"
  ON public.campus_post_polls
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.campus_posts p
      WHERE p.id = campus_post_polls.post_id
        AND (
          p.author_id = auth.uid()
          OR public.has_role(auth.uid(), 'admin')
        )
    )
  );

DROP POLICY IF EXISTS "campus poll options select visible_posts" ON public.campus_post_poll_options;
CREATE POLICY "campus poll options select visible_posts"
  ON public.campus_post_poll_options
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.campus_post_polls cp
      JOIN public.campus_posts p ON p.id = cp.post_id
      WHERE cp.id = campus_post_poll_options.poll_id
        AND (
          p.post_type <> 'story'
          OR p.expires_at > now()
          OR p.author_id = auth.uid()
          OR public.has_role(auth.uid(), 'admin')
        )
    )
  );

DROP POLICY IF EXISTS "campus poll options insert own_or_admin" ON public.campus_post_poll_options;
CREATE POLICY "campus poll options insert own_or_admin"
  ON public.campus_post_poll_options
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.campus_post_polls cp
      JOIN public.campus_posts p ON p.id = cp.post_id
      WHERE cp.id = campus_post_poll_options.poll_id
        AND (
          p.author_id = auth.uid()
          OR public.has_role(auth.uid(), 'admin')
        )
    )
  );

DROP POLICY IF EXISTS "campus poll options delete own_or_admin" ON public.campus_post_poll_options;
CREATE POLICY "campus poll options delete own_or_admin"
  ON public.campus_post_poll_options
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.campus_post_polls cp
      JOIN public.campus_posts p ON p.id = cp.post_id
      WHERE cp.id = campus_post_poll_options.poll_id
        AND (
          p.author_id = auth.uid()
          OR public.has_role(auth.uid(), 'admin')
        )
    )
  );

DROP POLICY IF EXISTS "campus poll votes select visible_posts" ON public.campus_post_poll_votes;
CREATE POLICY "campus poll votes select visible_posts"
  ON public.campus_post_poll_votes
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.campus_post_polls cp
      JOIN public.campus_posts p ON p.id = cp.post_id
      WHERE cp.id = campus_post_poll_votes.poll_id
        AND (
          p.post_type <> 'story'
          OR p.expires_at > now()
          OR p.author_id = auth.uid()
          OR public.has_role(auth.uid(), 'admin')
        )
    )
  );

DROP POLICY IF EXISTS "campus poll votes insert own" ON public.campus_post_poll_votes;
CREATE POLICY "campus poll votes insert own"
  ON public.campus_post_poll_votes
  FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.campus_post_polls cp
      JOIN public.campus_posts p ON p.id = cp.post_id
      JOIN public.campus_post_poll_options cpo ON cpo.id = campus_post_poll_votes.option_id
      WHERE cp.id = campus_post_poll_votes.poll_id
        AND cpo.poll_id = cp.id
        AND p.post_type = 'thread'
    )
  );

DROP POLICY IF EXISTS "campus poll votes delete own_or_admin" ON public.campus_post_poll_votes;
CREATE POLICY "campus poll votes delete own_or_admin"
  ON public.campus_post_poll_votes
  FOR DELETE
  TO authenticated
  USING (
    user_id = auth.uid()
    OR public.has_role(auth.uid(), 'admin')
  );

CREATE OR REPLACE FUNCTION public.refresh_campus_poll_counts(_poll_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  UPDATE public.campus_post_poll_options o
  SET
    votes_count = COALESCE((
      SELECT COUNT(*)::integer
      FROM public.campus_post_poll_votes v
      WHERE v.option_id = o.id
    ), 0),
    updated_at = now()
  WHERE o.poll_id = _poll_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.create_campus_post_poll(
  _post_id uuid,
  _question text,
  _options text[]
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_uid uuid;
  v_poll_id uuid;
  v_clean_options text[];
  v_option text;
  v_index integer;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'authentication required';
  END IF;

  IF NULLIF(BTRIM(COALESCE(_question, '')), '') IS NULL THEN
    RAISE EXCEPTION 'poll question is required';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.campus_posts p
    WHERE p.id = _post_id
      AND p.post_type = 'thread'
      AND (p.author_id = v_uid OR public.has_role(v_uid, 'admin'))
  ) THEN
    RAISE EXCEPTION 'not allowed to attach poll to this post';
  END IF;

  SELECT COALESCE(array_agg(DISTINCT cleaned), ARRAY[]::text[])
  INTO v_clean_options
  FROM (
    SELECT NULLIF(BTRIM(option_text), '') AS cleaned
    FROM unnest(COALESCE(_options, ARRAY[]::text[])) AS option_text
  ) t
  WHERE cleaned IS NOT NULL;

  IF COALESCE(array_length(v_clean_options, 1), 0) < 2 OR COALESCE(array_length(v_clean_options, 1), 0) > 4 THEN
    RAISE EXCEPTION 'poll options must be between 2 and 4';
  END IF;

  INSERT INTO public.campus_post_polls (post_id, question)
  VALUES (_post_id, BTRIM(_question))
  RETURNING id INTO v_poll_id;

  v_index := 0;
  FOREACH v_option IN ARRAY v_clean_options LOOP
    INSERT INTO public.campus_post_poll_options (poll_id, option_text, sort_order)
    VALUES (v_poll_id, v_option, v_index);
    v_index := v_index + 1;
  END LOOP;

  RETURN v_poll_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.vote_campus_poll(
  _post_id uuid,
  _option_id uuid
)
RETURNS TABLE (
  option_id uuid,
  votes_count integer,
  total_votes integer,
  user_option_id uuid
)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_uid uuid;
  v_poll_id uuid;
  v_current_option_id uuid;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'authentication required';
  END IF;

  SELECT cp.id
  INTO v_poll_id
  FROM public.campus_post_polls cp
  JOIN public.campus_posts p ON p.id = cp.post_id
  WHERE cp.post_id = _post_id
    AND p.post_type = 'thread'
    AND (
      p.post_type <> 'story'
      OR p.expires_at > now()
      OR p.author_id = v_uid
      OR public.has_role(v_uid, 'admin')
    )
  LIMIT 1;

  IF v_poll_id IS NULL THEN
    RAISE EXCEPTION 'poll not found';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.campus_post_poll_options o
    WHERE o.id = _option_id
      AND o.poll_id = v_poll_id
  ) THEN
    RAISE EXCEPTION 'option not found in poll';
  END IF;

  SELECT v.option_id
  INTO v_current_option_id
  FROM public.campus_post_poll_votes v
  WHERE v.poll_id = v_poll_id
    AND v.user_id = v_uid
  LIMIT 1;

  IF v_current_option_id = _option_id THEN
    DELETE FROM public.campus_post_poll_votes
    WHERE poll_id = v_poll_id
      AND user_id = v_uid;
  ELSE
    INSERT INTO public.campus_post_poll_votes (poll_id, option_id, user_id)
    VALUES (v_poll_id, _option_id, v_uid)
    ON CONFLICT (poll_id, user_id)
    DO UPDATE SET
      option_id = EXCLUDED.option_id,
      created_at = now();
  END IF;

  PERFORM public.refresh_campus_poll_counts(v_poll_id);

  RETURN QUERY
  SELECT
    o.id AS option_id,
    o.votes_count,
    COALESCE((
      SELECT COUNT(*)::integer
      FROM public.campus_post_poll_votes pv
      WHERE pv.poll_id = v_poll_id
    ), 0) AS total_votes,
    (
      SELECT pv.option_id
      FROM public.campus_post_poll_votes pv
      WHERE pv.poll_id = v_poll_id
        AND pv.user_id = v_uid
      LIMIT 1
    ) AS user_option_id
  FROM public.campus_post_poll_options o
  WHERE o.poll_id = v_poll_id
  ORDER BY o.sort_order ASC;
END;
$$;

DROP TRIGGER IF EXISTS trg_update_campus_post_polls_updated_at ON public.campus_post_polls;
CREATE TRIGGER trg_update_campus_post_polls_updated_at
  BEFORE UPDATE ON public.campus_post_polls
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trg_update_campus_post_poll_options_updated_at ON public.campus_post_poll_options;
CREATE TRIGGER trg_update_campus_post_poll_options_updated_at
  BEFORE UPDATE ON public.campus_post_poll_options
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

GRANT EXECUTE ON FUNCTION public.refresh_campus_poll_counts(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_campus_post_poll(uuid, text, text[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.vote_campus_poll(uuid, uuid) TO authenticated;
