-- Campus stories: hard-delete expired rows to keep storage lean.

CREATE OR REPLACE FUNCTION public.cleanup_expired_campus_stories(_limit integer DEFAULT 1000)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_limit integer;
  v_deleted_count integer;
BEGIN
  v_limit := LEAST(GREATEST(COALESCE(_limit, 1000), 1), 10000);

  WITH candidate_ids AS (
    SELECT id
    FROM public.campus_posts
    WHERE post_type = 'story'
      AND expires_at IS NOT NULL
      AND expires_at <= now()
    ORDER BY expires_at ASC
    LIMIT v_limit
  ), deleted_rows AS (
    DELETE FROM public.campus_posts p
    USING candidate_ids c
    WHERE p.id = c.id
    RETURNING p.id
  )
  SELECT COUNT(*)::integer
  INTO v_deleted_count
  FROM deleted_rows;

  RETURN COALESCE(v_deleted_count, 0);
END;
$$;

REVOKE ALL ON FUNCTION public.cleanup_expired_campus_stories(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cleanup_expired_campus_stories(integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cleanup_expired_campus_stories(integer) TO service_role;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    IF EXISTS (
      SELECT 1
      FROM cron.job
      WHERE jobname = 'campus-story-cleanup-hourly'
    ) THEN
      PERFORM cron.unschedule(
        (
          SELECT jobid
          FROM cron.job
          WHERE jobname = 'campus-story-cleanup-hourly'
          ORDER BY jobid DESC
          LIMIT 1
        )
      );
    END IF;

    PERFORM cron.schedule(
      'campus-story-cleanup-hourly',
      '5 * * * *',
      'SELECT public.cleanup_expired_campus_stories(2000);'
    );
  END IF;
END;
$$;
