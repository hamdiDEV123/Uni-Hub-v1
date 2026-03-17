-- Campus Feed Phase 2.0
-- Hashtag extraction + trending topics

CREATE TABLE IF NOT EXISTS public.campus_post_hashtags (
  post_id uuid NOT NULL REFERENCES public.campus_posts(id) ON DELETE CASCADE,
  hashtag text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT campus_post_hashtags_pk PRIMARY KEY (post_id, hashtag),
  CONSTRAINT campus_post_hashtags_hashtag_format CHECK (hashtag ~* '^[a-z0-9_ء-ي]{2,40}$')
);

CREATE INDEX IF NOT EXISTS idx_campus_post_hashtags_hashtag_created
  ON public.campus_post_hashtags (hashtag, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_campus_post_hashtags_created
  ON public.campus_post_hashtags (created_at DESC);

ALTER TABLE public.campus_post_hashtags ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "campus hashtags select visible_posts" ON public.campus_post_hashtags;
CREATE POLICY "campus hashtags select visible_posts"
  ON public.campus_post_hashtags
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.campus_posts p
      WHERE p.id = campus_post_hashtags.post_id
        AND (
          p.post_type <> 'story'
          OR p.expires_at > now()
          OR p.author_id = auth.uid()
          OR public.has_role(auth.uid(), 'admin')
        )
    )
  );

CREATE OR REPLACE FUNCTION public.extract_campus_hashtags(_content text)
RETURNS text[]
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_matches text[];
  v_normalized text[];
BEGIN
  IF NULLIF(BTRIM(COALESCE(_content, '')), '') IS NULL THEN
    RETURN ARRAY[]::text[];
  END IF;

  SELECT COALESCE(array_agg(DISTINCT normalized_tag), ARRAY[]::text[])
  INTO v_normalized
  FROM (
    SELECT lower(m[1]) AS normalized_tag
    FROM regexp_matches(_content, '#([A-Za-z0-9_ء-ي]{2,40})', 'g') AS m
  ) t
  WHERE normalized_tag ~* '^[a-z0-9_ء-ي]{2,40}$';

  v_matches := COALESCE(v_normalized, ARRAY[]::text[]);

  IF array_length(v_matches, 1) IS NOT NULL AND array_length(v_matches, 1) > 20 THEN
    RETURN v_matches[1:20];
  END IF;

  RETURN v_matches;
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_campus_post_hashtags(
  _post_id uuid,
  _post_type text,
  _content text
)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_tags text[];
BEGIN
  DELETE FROM public.campus_post_hashtags
  WHERE post_id = _post_id;

  IF _post_type IS DISTINCT FROM 'thread' THEN
    RETURN;
  END IF;

  v_tags := public.extract_campus_hashtags(_content);

  IF COALESCE(array_length(v_tags, 1), 0) = 0 THEN
    RETURN;
  END IF;

  INSERT INTO public.campus_post_hashtags (post_id, hashtag)
  SELECT _post_id, t
  FROM unnest(v_tags) AS t
  ON CONFLICT DO NOTHING;
END;
$$;

CREATE OR REPLACE FUNCTION public.campus_on_post_hashtags_sync()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  PERFORM public.sync_campus_post_hashtags(NEW.id, NEW.post_type, NEW.content);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_campus_post_hashtags_sync ON public.campus_posts;
CREATE TRIGGER trg_campus_post_hashtags_sync
  AFTER INSERT OR UPDATE OF content, post_type ON public.campus_posts
  FOR EACH ROW
  EXECUTE FUNCTION public.campus_on_post_hashtags_sync();

CREATE OR REPLACE FUNCTION public.fetch_campus_trending_hashtags(
  _hours integer DEFAULT 24,
  _limit integer DEFAULT 8
)
RETURNS TABLE (hashtag text, posts_count integer, trend_score numeric)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_hours integer;
  v_limit integer;
BEGIN
  v_hours := LEAST(GREATEST(COALESCE(_hours, 24), 1), 168);
  v_limit := LEAST(GREATEST(COALESCE(_limit, 8), 1), 30);

  RETURN QUERY
  SELECT
    h.hashtag,
    COUNT(DISTINCT h.post_id)::integer AS posts_count,
    ROUND((COUNT(DISTINCT h.post_id)::numeric * 1.0) + LOG(10, GREATEST(COUNT(*)::numeric, 1)), 3) AS trend_score
  FROM public.campus_post_hashtags h
  JOIN public.campus_posts p
    ON p.id = h.post_id
  WHERE p.post_type = 'thread'
    AND p.created_at >= (now() - make_interval(hours => v_hours))
  GROUP BY h.hashtag
  ORDER BY trend_score DESC, posts_count DESC, h.hashtag ASC
  LIMIT v_limit;
END;
$$;

INSERT INTO public.campus_post_hashtags (post_id, hashtag)
SELECT
  p.id,
  t.tag
FROM public.campus_posts p
CROSS JOIN LATERAL unnest(public.extract_campus_hashtags(p.content)) AS t(tag)
WHERE p.post_type = 'thread'
ON CONFLICT DO NOTHING;

GRANT EXECUTE ON FUNCTION public.extract_campus_hashtags(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.sync_campus_post_hashtags(uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fetch_campus_trending_hashtags(integer, integer) TO authenticated;
