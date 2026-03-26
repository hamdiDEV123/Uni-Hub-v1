-- Study Hub favorites (P1 day 1)

CREATE TABLE IF NOT EXISTS public.study_material_favorites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  material_id uuid NOT NULL REFERENCES public.study_materials(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (material_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_study_material_favorites_user
  ON public.study_material_favorites (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_study_material_favorites_material
  ON public.study_material_favorites (material_id);

ALTER TABLE public.study_material_favorites ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "study favorites read own" ON public.study_material_favorites;
CREATE POLICY "study favorites read own"
  ON public.study_material_favorites
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "study favorites insert own" ON public.study_material_favorites;
CREATE POLICY "study favorites insert own"
  ON public.study_material_favorites
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "study favorites delete own" ON public.study_material_favorites;
CREATE POLICY "study favorites delete own"
  ON public.study_material_favorites
  FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());
