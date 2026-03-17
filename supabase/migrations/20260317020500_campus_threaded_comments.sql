-- Campus Feed Phase 4.0
-- Threaded comments (one-level replies)

ALTER TABLE public.campus_post_comments
  ADD COLUMN IF NOT EXISTS parent_comment_id uuid REFERENCES public.campus_post_comments(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_campus_post_comments_parent_created
  ON public.campus_post_comments (parent_comment_id, created_at ASC);

CREATE OR REPLACE FUNCTION public.validate_campus_comment_parent()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_parent_post_id uuid;
  v_parent_parent_id uuid;
BEGIN
  IF NEW.parent_comment_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT c.post_id, c.parent_comment_id
  INTO v_parent_post_id, v_parent_parent_id
  FROM public.campus_post_comments c
  WHERE c.id = NEW.parent_comment_id;

  IF v_parent_post_id IS NULL THEN
    RAISE EXCEPTION 'parent comment not found';
  END IF;

  IF v_parent_post_id IS DISTINCT FROM NEW.post_id THEN
    RAISE EXCEPTION 'reply must target a comment from the same post';
  END IF;

  IF v_parent_parent_id IS NOT NULL THEN
    RAISE EXCEPTION 'nested replies deeper than one level are not allowed';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_campus_comment_parent ON public.campus_post_comments;
CREATE TRIGGER trg_validate_campus_comment_parent
  BEFORE INSERT OR UPDATE OF parent_comment_id, post_id
  ON public.campus_post_comments
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_campus_comment_parent();

GRANT EXECUTE ON FUNCTION public.validate_campus_comment_parent() TO authenticated;
