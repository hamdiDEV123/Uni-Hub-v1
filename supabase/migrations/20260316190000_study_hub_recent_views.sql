-- Study Hub recently viewed (P1 day 2)

CREATE TABLE IF NOT EXISTS public.study_material_views (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  material_id uuid NOT NULL REFERENCES public.study_materials(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  viewed_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (material_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_study_material_views_user_recent
  ON public.study_material_views (user_id, viewed_at DESC);

CREATE INDEX IF NOT EXISTS idx_study_material_views_material
  ON public.study_material_views (material_id);

ALTER TABLE public.study_material_views ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "study views read own" ON public.study_material_views;
CREATE POLICY "study views read own"
  ON public.study_material_views
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "study views insert own" ON public.study_material_views;
CREATE POLICY "study views insert own"
  ON public.study_material_views
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "study views update own" ON public.study_material_views;
CREATE POLICY "study views update own"
  ON public.study_material_views
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "study views delete own" ON public.study_material_views;
CREATE POLICY "study views delete own"
  ON public.study_material_views
  FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());
