-- Campus Feed (Phase 1)
-- Stories + Threads + Upvotes + Comments + Streak/Karma foundation

CREATE TABLE IF NOT EXISTS public.campus_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  post_type text NOT NULL CHECK (post_type IN ('thread', 'story')),
  category text NOT NULL DEFAULT 'general' CHECK (category IN ('general', 'academic', 'memes', 'lost_found')),
  content text,
  media_url text CHECK (media_url IS NULL OR media_url ~* '^https?://'),
  is_anonymous boolean NOT NULL DEFAULT false,
  is_pinned boolean NOT NULL DEFAULT false,
  pinned_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  pinned_at timestamptz,
  scope_faculty text,
  scope_study_year text,
  scope_term text,
  upvotes_count integer NOT NULL DEFAULT 0,
  comments_count integer NOT NULL DEFAULT 0,
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT campus_posts_content_or_media_required
    CHECK (NULLIF(BTRIM(content), '') IS NOT NULL OR media_url IS NOT NULL),
  CONSTRAINT campus_posts_story_expiry_check
    CHECK (
      (post_type = 'story' AND expires_at IS NOT NULL)
      OR (post_type = 'thread' AND expires_at IS NULL)
    )
);

CREATE TABLE IF NOT EXISTS public.campus_post_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES public.campus_posts(id) ON DELETE CASCADE,
  author_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  content text NOT NULL CHECK (NULLIF(BTRIM(content), '') IS NOT NULL),
  is_anonymous boolean NOT NULL DEFAULT false,
  is_verified_answer boolean NOT NULL DEFAULT false,
  verified_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  verified_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.campus_post_interactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES public.campus_posts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  interaction_type text NOT NULL CHECK (interaction_type IN ('upvote')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (post_id, user_id, interaction_type)
);

CREATE TABLE IF NOT EXISTS public.user_gamification (
  user_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  current_streak integer NOT NULL DEFAULT 0 CHECK (current_streak >= 0),
  highest_streak integer NOT NULL DEFAULT 0 CHECK (highest_streak >= 0),
  last_active_date date,
  karma_points integer NOT NULL DEFAULT 0 CHECK (karma_points >= 0),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_campus_posts_feed
  ON public.campus_posts (is_pinned DESC, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_campus_posts_story_expiry
  ON public.campus_posts (expires_at)
  WHERE post_type = 'story';

CREATE INDEX IF NOT EXISTS idx_campus_posts_category_created
  ON public.campus_posts (category, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_campus_posts_scope
  ON public.campus_posts (scope_faculty, scope_study_year, scope_term);

CREATE INDEX IF NOT EXISTS idx_campus_post_comments_post_created
  ON public.campus_post_comments (post_id, created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS idx_campus_post_comments_verified_once
  ON public.campus_post_comments (post_id)
  WHERE is_verified_answer = true;

CREATE INDEX IF NOT EXISTS idx_campus_post_interactions_user
  ON public.campus_post_interactions (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_user_gamification_rank
  ON public.user_gamification (current_streak DESC, karma_points DESC);

ALTER TABLE public.campus_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campus_post_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campus_post_interactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_gamification ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "campus posts select visible" ON public.campus_posts;
CREATE POLICY "campus posts select visible"
  ON public.campus_posts
  FOR SELECT
  TO authenticated
  USING (
    post_type <> 'story'
    OR expires_at > now()
    OR author_id = auth.uid()
    OR public.has_role(auth.uid(), 'admin')
  );

DROP POLICY IF EXISTS "campus posts insert own" ON public.campus_posts;
CREATE POLICY "campus posts insert own"
  ON public.campus_posts
  FOR INSERT
  TO authenticated
  WITH CHECK (
    author_id = auth.uid()
    AND is_pinned = false
    AND pinned_by IS NULL
    AND pinned_at IS NULL
  );

DROP POLICY IF EXISTS "campus posts update own" ON public.campus_posts;
CREATE POLICY "campus posts update own"
  ON public.campus_posts
  FOR UPDATE
  TO authenticated
  USING (author_id = auth.uid())
  WITH CHECK (author_id = auth.uid());

DROP POLICY IF EXISTS "campus posts update admin" ON public.campus_posts;
CREATE POLICY "campus posts update admin"
  ON public.campus_posts
  FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "campus posts delete own_or_admin" ON public.campus_posts;
CREATE POLICY "campus posts delete own_or_admin"
  ON public.campus_posts
  FOR DELETE
  TO authenticated
  USING (author_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "campus comments select visible_posts" ON public.campus_post_comments;
CREATE POLICY "campus comments select visible_posts"
  ON public.campus_post_comments
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.campus_posts p
      WHERE p.id = campus_post_comments.post_id
        AND (
          p.post_type <> 'story'
          OR p.expires_at > now()
          OR p.author_id = auth.uid()
          OR public.has_role(auth.uid(), 'admin')
        )
    )
  );

DROP POLICY IF EXISTS "campus comments insert own" ON public.campus_post_comments;
CREATE POLICY "campus comments insert own"
  ON public.campus_post_comments
  FOR INSERT
  TO authenticated
  WITH CHECK (
    author_id = auth.uid()
    AND is_verified_answer = false
    AND verified_by IS NULL
    AND verified_at IS NULL
    AND EXISTS (
      SELECT 1
      FROM public.campus_posts p
      WHERE p.id = campus_post_comments.post_id
        AND (
          p.post_type <> 'story'
          OR p.expires_at > now()
          OR p.author_id = auth.uid()
          OR public.has_role(auth.uid(), 'admin')
        )
    )
  );

DROP POLICY IF EXISTS "campus comments update own" ON public.campus_post_comments;
CREATE POLICY "campus comments update own"
  ON public.campus_post_comments
  FOR UPDATE
  TO authenticated
  USING (author_id = auth.uid())
  WITH CHECK (
    author_id = auth.uid()
    AND is_verified_answer = false
    AND verified_by IS NULL
    AND verified_at IS NULL
  );

DROP POLICY IF EXISTS "campus comments update admin" ON public.campus_post_comments;
CREATE POLICY "campus comments update admin"
  ON public.campus_post_comments
  FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "campus comments delete own_or_admin" ON public.campus_post_comments;
CREATE POLICY "campus comments delete own_or_admin"
  ON public.campus_post_comments
  FOR DELETE
  TO authenticated
  USING (author_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "campus interactions select visible_posts" ON public.campus_post_interactions;
CREATE POLICY "campus interactions select visible_posts"
  ON public.campus_post_interactions
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
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

DROP POLICY IF EXISTS "campus interactions insert own" ON public.campus_post_interactions;
CREATE POLICY "campus interactions insert own"
  ON public.campus_post_interactions
  FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND interaction_type = 'upvote'
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

DROP POLICY IF EXISTS "campus interactions delete own_or_admin" ON public.campus_post_interactions;
CREATE POLICY "campus interactions delete own_or_admin"
  ON public.campus_post_interactions
  FOR DELETE
  TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "user gamification select authenticated" ON public.user_gamification;
CREATE POLICY "user gamification select authenticated"
  ON public.user_gamification
  FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "user gamification insert own" ON public.user_gamification;
CREATE POLICY "user gamification insert own"
  ON public.user_gamification
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "user gamification update own_or_admin" ON public.user_gamification;
CREATE POLICY "user gamification update own_or_admin"
  ON public.user_gamification
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.record_campus_activity(_user_id uuid, _karma_delta integer DEFAULT 0)
RETURNS TABLE (current_streak integer, highest_streak integer, last_active_date date, karma_points integer)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_uid uuid;
  v_today date;
  v_row public.user_gamification%ROWTYPE;
  v_next_streak integer;
  v_next_highest integer;
  v_next_karma integer;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'authentication required';
  END IF;

  IF _user_id IS DISTINCT FROM v_uid AND NOT public.has_role(v_uid, 'admin') THEN
    RAISE EXCEPTION 'not allowed to record activity for another user';
  END IF;

  v_today := timezone('utc', now())::date;

  SELECT * INTO v_row
  FROM public.user_gamification
  WHERE user_id = _user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    v_next_streak := 1;
    v_next_highest := 1;
    v_next_karma := GREATEST(0, _karma_delta);

    INSERT INTO public.user_gamification (
      user_id,
      current_streak,
      highest_streak,
      last_active_date,
      karma_points,
      updated_at
    ) VALUES (
      _user_id,
      v_next_streak,
      v_next_highest,
      v_today,
      v_next_karma,
      now()
    );
  ELSE
    IF v_row.last_active_date IS NULL THEN
      v_next_streak := 1;
    ELSIF v_row.last_active_date = v_today THEN
      v_next_streak := v_row.current_streak;
    ELSIF v_row.last_active_date = (v_today - 1) THEN
      v_next_streak := v_row.current_streak + 1;
    ELSE
      v_next_streak := 1;
    END IF;

    v_next_highest := GREATEST(v_row.highest_streak, v_next_streak);
    v_next_karma := GREATEST(0, v_row.karma_points + _karma_delta);

    UPDATE public.user_gamification
    SET
      current_streak = v_next_streak,
      highest_streak = v_next_highest,
      last_active_date = v_today,
      karma_points = v_next_karma,
      updated_at = now()
    WHERE user_id = _user_id;
  END IF;

  RETURN QUERY
  SELECT
    ug.current_streak,
    ug.highest_streak,
    ug.last_active_date,
    ug.karma_points
  FROM public.user_gamification ug
  WHERE ug.user_id = _user_id;
END;
$$;

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
    comments_count = COALESCE((
      SELECT COUNT(*)::integer
      FROM public.campus_post_comments c
      WHERE c.post_id = _post_id
    ), 0),
    updated_at = now()
  WHERE p.id = _post_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.toggle_campus_post_upvote(_post_id uuid)
RETURNS TABLE (upvotes_count integer, user_has_upvoted boolean)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_uid uuid;
  v_exists boolean;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'authentication required';
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

  IF EXISTS (
    SELECT 1
    FROM public.campus_post_interactions i
    WHERE i.post_id = _post_id
      AND i.user_id = v_uid
      AND i.interaction_type = 'upvote'
  ) THEN
    DELETE FROM public.campus_post_interactions
    WHERE post_id = _post_id
      AND user_id = v_uid
      AND interaction_type = 'upvote';
  ELSE
    INSERT INTO public.campus_post_interactions (post_id, user_id, interaction_type)
    VALUES (_post_id, v_uid, 'upvote');
  END IF;

  PERFORM public.refresh_campus_post_counters(_post_id);

  RETURN QUERY
  SELECT
    p.upvotes_count,
    EXISTS (
      SELECT 1
      FROM public.campus_post_interactions i
      WHERE i.post_id = p.id
        AND i.user_id = v_uid
        AND i.interaction_type = 'upvote'
    ) AS user_has_upvoted
  FROM public.campus_posts p
  WHERE p.id = _post_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.campus_on_post_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_karma_delta integer;
BEGIN
  v_karma_delta := CASE WHEN NEW.post_type = 'story' THEN 2 ELSE 3 END;
  PERFORM public.record_campus_activity(NEW.author_id, v_karma_delta);
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.campus_on_comment_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  PERFORM public.record_campus_activity(NEW.author_id, 1);
  PERFORM public.refresh_campus_post_counters(NEW.post_id);
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.campus_on_comment_delete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  PERFORM public.refresh_campus_post_counters(OLD.post_id);
  RETURN OLD;
END;
$$;

CREATE OR REPLACE FUNCTION public.campus_on_interaction_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  PERFORM public.record_campus_activity(NEW.user_id, 1);
  PERFORM public.refresh_campus_post_counters(NEW.post_id);
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.campus_on_interaction_delete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  UPDATE public.user_gamification
  SET
    karma_points = GREATEST(0, karma_points - 1),
    updated_at = now()
  WHERE user_id = OLD.user_id;

  PERFORM public.refresh_campus_post_counters(OLD.post_id);
  RETURN OLD;
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

CREATE OR REPLACE FUNCTION public.guard_campus_comments_sensitive_fields()
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

  IF NEW.post_id IS DISTINCT FROM OLD.post_id
     OR NEW.author_id IS DISTINCT FROM OLD.author_id THEN
    RAISE EXCEPTION 'post_id and author_id cannot be changed';
  END IF;

  IF NEW.is_verified_answer IS DISTINCT FROM OLD.is_verified_answer
     OR NEW.verified_by IS DISTINCT FROM OLD.verified_by
     OR NEW.verified_at IS DISTINCT FROM OLD.verified_at THEN
    RAISE EXCEPTION 'only admins can mark verified answers';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_update_campus_posts_updated_at ON public.campus_posts;
CREATE TRIGGER trg_update_campus_posts_updated_at
  BEFORE UPDATE ON public.campus_posts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trg_update_campus_comments_updated_at ON public.campus_post_comments;
CREATE TRIGGER trg_update_campus_comments_updated_at
  BEFORE UPDATE ON public.campus_post_comments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trg_update_user_gamification_updated_at ON public.user_gamification;
CREATE TRIGGER trg_update_user_gamification_updated_at
  BEFORE UPDATE ON public.user_gamification
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trg_campus_post_insert_activity ON public.campus_posts;
CREATE TRIGGER trg_campus_post_insert_activity
  AFTER INSERT ON public.campus_posts
  FOR EACH ROW EXECUTE FUNCTION public.campus_on_post_insert();

DROP TRIGGER IF EXISTS trg_campus_comment_insert_activity ON public.campus_post_comments;
CREATE TRIGGER trg_campus_comment_insert_activity
  AFTER INSERT ON public.campus_post_comments
  FOR EACH ROW EXECUTE FUNCTION public.campus_on_comment_insert();

DROP TRIGGER IF EXISTS trg_campus_comment_delete_refresh ON public.campus_post_comments;
CREATE TRIGGER trg_campus_comment_delete_refresh
  AFTER DELETE ON public.campus_post_comments
  FOR EACH ROW EXECUTE FUNCTION public.campus_on_comment_delete();

DROP TRIGGER IF EXISTS trg_campus_interaction_insert_activity ON public.campus_post_interactions;
CREATE TRIGGER trg_campus_interaction_insert_activity
  AFTER INSERT ON public.campus_post_interactions
  FOR EACH ROW EXECUTE FUNCTION public.campus_on_interaction_insert();

DROP TRIGGER IF EXISTS trg_campus_interaction_delete_activity ON public.campus_post_interactions;
CREATE TRIGGER trg_campus_interaction_delete_activity
  AFTER DELETE ON public.campus_post_interactions
  FOR EACH ROW EXECUTE FUNCTION public.campus_on_interaction_delete();

DROP TRIGGER IF EXISTS trg_guard_campus_posts_sensitive_fields ON public.campus_posts;
CREATE TRIGGER trg_guard_campus_posts_sensitive_fields
  BEFORE UPDATE ON public.campus_posts
  FOR EACH ROW EXECUTE FUNCTION public.guard_campus_posts_sensitive_fields();

DROP TRIGGER IF EXISTS trg_guard_campus_comments_sensitive_fields ON public.campus_post_comments;
CREATE TRIGGER trg_guard_campus_comments_sensitive_fields
  BEFORE UPDATE ON public.campus_post_comments
  FOR EACH ROW EXECUTE FUNCTION public.guard_campus_comments_sensitive_fields();

GRANT EXECUTE ON FUNCTION public.record_campus_activity(uuid, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.refresh_campus_post_counters(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.toggle_campus_post_upvote(uuid) TO authenticated;
