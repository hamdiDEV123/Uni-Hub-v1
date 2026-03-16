-- Study Hub security hardening for launch readiness
-- 1) Allow admins to clear reports
-- 2) Prevent non-admin users from changing moderation or ranking-sensitive fields

DROP POLICY IF EXISTS "study reports delete admin only" ON public.study_material_reports;
CREATE POLICY "study reports delete admin only"
  ON public.study_material_reports
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.role = 'admin'
    )
  );

CREATE OR REPLACE FUNCTION public.guard_study_material_update_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_is_admin boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.role = 'admin'
  ) INTO v_is_admin;

  IF COALESCE(v_is_admin, false) THEN
    RETURN NEW;
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status THEN
    RAISE EXCEPTION 'only admins can change study material status';
  END IF;

  IF NEW.upvotes IS DISTINCT FROM OLD.upvotes
     OR NEW.downvotes IS DISTINCT FROM OLD.downvotes THEN
    RAISE EXCEPTION 'manual vote counters update is not allowed';
  END IF;

  IF NEW.university IS DISTINCT FROM OLD.university
     OR NEW.faculty IS DISTINCT FROM OLD.faculty
     OR NEW.study_year IS DISTINCT FROM OLD.study_year
     OR NEW.term IS DISTINCT FROM OLD.term
     OR NEW.course_name IS DISTINCT FROM OLD.course_name
     OR NEW.material_type IS DISTINCT FROM OLD.material_type
     OR NEW.owner_id IS DISTINCT FROM OLD.owner_id THEN
    RAISE EXCEPTION 'only title/description/resource link can be edited by owner';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_study_material_update_fields ON public.study_materials;
CREATE TRIGGER trg_guard_study_material_update_fields
  BEFORE UPDATE ON public.study_materials
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_study_material_update_fields();
