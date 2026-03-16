-- Study Hub moderation + reporting (P0)

ALTER TABLE public.study_materials
ADD COLUMN IF NOT EXISTS status text;

UPDATE public.study_materials
SET status = 'active'
WHERE status IS NULL;

ALTER TABLE public.study_materials
ALTER COLUMN status SET DEFAULT 'active';

ALTER TABLE public.study_materials
ALTER COLUMN status SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'study_materials_status_check'
  ) THEN
    ALTER TABLE public.study_materials
    ADD CONSTRAINT study_materials_status_check
    CHECK (status IN ('active', 'under_review', 'removed'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_study_materials_status
  ON public.study_materials (status);

CREATE TABLE IF NOT EXISTS public.study_material_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  material_id uuid NOT NULL REFERENCES public.study_materials(id) ON DELETE CASCADE,
  reporter_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (material_id, reporter_id)
);

CREATE INDEX IF NOT EXISTS idx_study_material_reports_material
  ON public.study_material_reports (material_id);

ALTER TABLE public.study_material_reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "study reports insert own" ON public.study_material_reports;
CREATE POLICY "study reports insert own"
  ON public.study_material_reports
  FOR INSERT
  TO authenticated
  WITH CHECK (reporter_id = auth.uid());

DROP POLICY IF EXISTS "study reports select own_or_admin" ON public.study_material_reports;
CREATE POLICY "study reports select own_or_admin"
  ON public.study_material_reports
  FOR SELECT
  TO authenticated
  USING (
    reporter_id = auth.uid()
    OR EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.role = 'admin'
    )
  );

DROP POLICY IF EXISTS "study materials update own" ON public.study_materials;
DROP POLICY IF EXISTS "study materials update owner_or_admin" ON public.study_materials;
CREATE POLICY "study materials update owner_or_admin"
  ON public.study_materials
  FOR UPDATE
  TO authenticated
  USING (
    owner_id = auth.uid()
    OR EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.role = 'admin'
    )
  )
  WITH CHECK (
    owner_id = auth.uid()
    OR EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.role = 'admin'
    )
  );
