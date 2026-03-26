-- Study Hub duplicate-link guard (P0 day 4)
-- Prevent duplicate resource link in same university/faculty/year/term/course scope.

ALTER TABLE public.study_materials
ADD COLUMN IF NOT EXISTS resource_url_normalized text;

UPDATE public.study_materials
SET resource_url_normalized = lower(btrim(resource_url))
WHERE resource_url_normalized IS NULL;

ALTER TABLE public.study_materials
ALTER COLUMN resource_url_normalized SET NOT NULL;

ALTER TABLE public.study_materials
ALTER COLUMN resource_url_normalized SET DEFAULT '';

CREATE INDEX IF NOT EXISTS idx_study_materials_scope_lookup
  ON public.study_materials (university, faculty, study_year, term, course_name, resource_url_normalized);

CREATE OR REPLACE FUNCTION public.enforce_study_material_duplicate_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  duplicate_exists boolean;
BEGIN
  NEW.resource_url_normalized := lower(btrim(COALESCE(NEW.resource_url, '')));

  IF NEW.status = 'removed' THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE'
     AND NEW.university = OLD.university
     AND NEW.faculty = OLD.faculty
     AND NEW.study_year = OLD.study_year
     AND NEW.term = OLD.term
     AND NEW.course_name = OLD.course_name
     AND NEW.resource_url_normalized = OLD.resource_url_normalized
     AND NEW.status = OLD.status THEN
    RETURN NEW;
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.study_materials sm
    WHERE sm.id <> COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)
      AND sm.university = NEW.university
      AND sm.faculty = NEW.faculty
      AND sm.study_year = NEW.study_year
      AND sm.term = NEW.term
      AND sm.course_name = NEW.course_name
      AND sm.resource_url_normalized = NEW.resource_url_normalized
      AND sm.status <> 'removed'
  ) INTO duplicate_exists;

  IF duplicate_exists THEN
    RAISE EXCEPTION 'duplicate study material resource link in same scope';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_study_materials_duplicate_guard ON public.study_materials;
CREATE TRIGGER trg_study_materials_duplicate_guard
  BEFORE INSERT OR UPDATE ON public.study_materials
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_study_material_duplicate_guard();
