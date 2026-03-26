-- Study Hub: add university dimension for first-level filtering

ALTER TABLE public.study_materials
ADD COLUMN IF NOT EXISTS university text;

UPDATE public.study_materials
SET university = 'جامعة الدلتا'
WHERE university IS NULL;

ALTER TABLE public.study_materials
ALTER COLUMN university SET NOT NULL;

ALTER TABLE public.study_materials
ALTER COLUMN university SET DEFAULT 'جامعة الدلتا';

CREATE INDEX IF NOT EXISTS idx_study_materials_university
  ON public.study_materials (university);
