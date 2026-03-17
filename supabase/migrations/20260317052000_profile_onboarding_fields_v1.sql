-- Profile onboarding fields (v1)
-- Adds lightweight student context fields without enforcing university card upload.

BEGIN;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS university TEXT,
  ADD COLUMN IF NOT EXISTS faculty TEXT,
  ADD COLUMN IF NOT EXISTS study_year TEXT,
  ADD COLUMN IF NOT EXISTS phone TEXT,
  ADD COLUMN IF NOT EXISTS bio TEXT,
  ADD COLUMN IF NOT EXISTS cover_url TEXT,
  ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_phone_format_check;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_phone_format_check
  CHECK (
    phone IS NULL
    OR btrim(phone) = ''
    OR phone ~ '^[0-9+][0-9\-\s]{7,19}$'
  );

CREATE INDEX IF NOT EXISTS idx_profiles_university_faculty_study_year
  ON public.profiles(university, faculty, study_year);

CREATE INDEX IF NOT EXISTS idx_profiles_onboarding_completed
  ON public.profiles(onboarding_completed);

-- Mark existing users as onboarded if they already have enough context.
UPDATE public.profiles
SET onboarding_completed = TRUE
WHERE onboarding_completed = FALSE
  AND NULLIF(btrim(COALESCE(university, '')), '') IS NOT NULL
  AND NULLIF(btrim(COALESCE(faculty, '')), '') IS NOT NULL
  AND NULLIF(btrim(COALESCE(study_year, '')), '') IS NOT NULL;

COMMIT;
