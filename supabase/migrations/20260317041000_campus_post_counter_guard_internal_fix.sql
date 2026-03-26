-- Campus Feed hotfix
-- Root cause fix: counter refresh updates were blocked by guard trigger for non-admin users.
-- This migration allows trusted internal refresh flow while preserving normal anti-tampering checks.

CREATE OR REPLACE FUNCTION public.refresh_campus_post_counters(_post_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  PERFORM set_config('app.campus_internal_counter_update', '1', true);

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

CREATE OR REPLACE FUNCTION public.guard_campus_posts_sensitive_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_is_admin boolean;
  v_internal_counter_update boolean;
BEGIN
  v_is_admin := public.has_role(auth.uid(), 'admin');
  v_internal_counter_update := COALESCE(current_setting('app.campus_internal_counter_update', true), '0') = '1';

  IF COALESCE(v_is_admin, false) THEN
    RETURN NEW;
  END IF;

  IF v_internal_counter_update THEN
    IF NEW.author_id IS DISTINCT FROM OLD.author_id
       OR NEW.is_pinned IS DISTINCT FROM OLD.is_pinned
       OR NEW.pinned_by IS DISTINCT FROM OLD.pinned_by
       OR NEW.pinned_at IS DISTINCT FROM OLD.pinned_at
       OR NEW.post_type IS DISTINCT FROM OLD.post_type
       OR NEW.expires_at IS DISTINCT FROM OLD.expires_at THEN
      RAISE EXCEPTION 'internal counter refresh cannot change protected post fields';
    END IF;

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

GRANT EXECUTE ON FUNCTION public.refresh_campus_post_counters(uuid) TO authenticated;
