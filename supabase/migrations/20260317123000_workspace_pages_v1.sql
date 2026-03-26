BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TABLE IF NOT EXISTS public.workspace_pages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  parent_id uuid NULL REFERENCES public.workspace_pages(id) ON DELETE CASCADE,
  title text NOT NULL DEFAULT 'صفحة جديدة',
  icon text NULL,
  cover_image text NULL,
  content jsonb NOT NULL DEFAULT '[]'::jsonb,
  is_favorite boolean NOT NULL DEFAULT false,
  position integer NOT NULL DEFAULT 0,
  is_archived boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT workspace_pages_title_not_blank CHECK (NULLIF(btrim(title), '') IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_workspace_pages_user_parent
  ON public.workspace_pages(user_id, parent_id);

CREATE INDEX IF NOT EXISTS idx_workspace_pages_user_updated
  ON public.workspace_pages(user_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_workspace_pages_user_favorites
  ON public.workspace_pages(user_id, is_favorite)
  WHERE is_archived = false;
  

ALTER TABLE public.workspace_pages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own workspace pages" ON public.workspace_pages;
CREATE POLICY "Users can view own workspace pages"
  ON public.workspace_pages
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can create own workspace pages" ON public.workspace_pages;
CREATE POLICY "Users can create own workspace pages"
  ON public.workspace_pages
  FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND (
      parent_id IS NULL
      OR EXISTS (
        SELECT 1
        FROM public.workspace_pages parent
        WHERE parent.id = workspace_pages.parent_id
          AND parent.user_id = auth.uid()
      )
    )
  );

DROP POLICY IF EXISTS "Users can update own workspace pages" ON public.workspace_pages;
CREATE POLICY "Users can update own workspace pages"
  ON public.workspace_pages
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (
    user_id = auth.uid()
    AND (
      parent_id IS NULL
      OR EXISTS (
        SELECT 1
        FROM public.workspace_pages parent
        WHERE parent.id = workspace_pages.parent_id
          AND parent.user_id = auth.uid()
      )
    )
  );

DROP POLICY IF EXISTS "Users can delete own workspace pages" ON public.workspace_pages;
CREATE POLICY "Users can delete own workspace pages"
  ON public.workspace_pages
  FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

DROP TRIGGER IF EXISTS trg_workspace_pages_updated_at ON public.workspace_pages;
CREATE TRIGGER trg_workspace_pages_updated_at
  BEFORE UPDATE ON public.workspace_pages
  FOR EACH ROW
  EXECUTE FUNCTION public.touch_updated_at();

COMMIT;
