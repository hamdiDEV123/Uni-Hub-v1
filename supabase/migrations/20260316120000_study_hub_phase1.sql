-- Study Hub / Academic Bank (Phase 1)
-- Text-link based materials catalog + voting system (no file uploads)

CREATE TABLE IF NOT EXISTS public.study_materials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  faculty text NOT NULL,
  study_year text NOT NULL,
  term text NOT NULL,
  course_name text NOT NULL,
  material_type text NOT NULL CHECK (
    material_type IN ('doctor_lecture', 'ta_section', 'student_summary', 'past_exam')
  ),
  title text NOT NULL,
  description text,
  resource_url text NOT NULL CHECK (resource_url ~* '^https?://'),
  upvotes integer NOT NULL DEFAULT 0,
  downvotes integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.study_material_votes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  material_id uuid NOT NULL REFERENCES public.study_materials(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  vote smallint NOT NULL CHECK (vote IN (-1, 1)),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (material_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_study_materials_filters
  ON public.study_materials (faculty, study_year, term, course_name, material_type);

CREATE INDEX IF NOT EXISTS idx_study_materials_created_at
  ON public.study_materials (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_study_material_votes_material_id
  ON public.study_material_votes (material_id);

ALTER TABLE public.study_materials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.study_material_votes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "study materials read for authenticated" ON public.study_materials;
CREATE POLICY "study materials read for authenticated"
  ON public.study_materials
  FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "study materials insert own" ON public.study_materials;
CREATE POLICY "study materials insert own"
  ON public.study_materials
  FOR INSERT
  TO authenticated
  WITH CHECK (owner_id = auth.uid());

DROP POLICY IF EXISTS "study materials update own" ON public.study_materials;
CREATE POLICY "study materials update own"
  ON public.study_materials
  FOR UPDATE
  TO authenticated
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

DROP POLICY IF EXISTS "study materials delete own" ON public.study_materials;
CREATE POLICY "study materials delete own"
  ON public.study_materials
  FOR DELETE
  TO authenticated
  USING (owner_id = auth.uid());

DROP POLICY IF EXISTS "study votes read for authenticated" ON public.study_material_votes;
CREATE POLICY "study votes read for authenticated"
  ON public.study_material_votes
  FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "study votes insert own" ON public.study_material_votes;
CREATE POLICY "study votes insert own"
  ON public.study_material_votes
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "study votes update own" ON public.study_material_votes;
CREATE POLICY "study votes update own"
  ON public.study_material_votes
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "study votes delete own" ON public.study_material_votes;
CREATE POLICY "study votes delete own"
  ON public.study_material_votes
  FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

DROP TRIGGER IF EXISTS update_study_materials_updated_at ON public.study_materials;
CREATE TRIGGER update_study_materials_updated_at
  BEFORE UPDATE ON public.study_materials
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_study_material_votes_updated_at ON public.study_material_votes;
CREATE TRIGGER update_study_material_votes_updated_at
  BEFORE UPDATE ON public.study_material_votes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.vote_study_material(_material_id uuid, _vote smallint)
RETURNS TABLE (upvotes integer, downvotes integer, score integer, user_vote smallint)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  _uid uuid;
  _existing_vote smallint;
  _new_user_vote smallint;
BEGIN
  IF _vote NOT IN (-1, 1) THEN
    RAISE EXCEPTION 'invalid vote value';
  END IF;

  _uid := auth.uid();
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'authentication required';
  END IF;

  SELECT vote INTO _existing_vote
  FROM public.study_material_votes
  WHERE material_id = _material_id
    AND user_id = _uid;

  IF _existing_vote IS NULL THEN
    INSERT INTO public.study_material_votes (material_id, user_id, vote)
    VALUES (_material_id, _uid, _vote);
    _new_user_vote := _vote;
  ELSIF _existing_vote = _vote THEN
    DELETE FROM public.study_material_votes
    WHERE material_id = _material_id
      AND user_id = _uid;
    _new_user_vote := 0;
  ELSE
    UPDATE public.study_material_votes
    SET vote = _vote
    WHERE material_id = _material_id
      AND user_id = _uid;
    _new_user_vote := _vote;
  END IF;

  UPDATE public.study_materials AS sm
  SET
    upvotes = COALESCE(v.up_count, 0),
    downvotes = COALESCE(v.down_count, 0)
  FROM (
    SELECT
      material_id,
      COUNT(*) FILTER (WHERE vote = 1) AS up_count,
      COUNT(*) FILTER (WHERE vote = -1) AS down_count
    FROM public.study_material_votes
    WHERE material_id = _material_id
    GROUP BY material_id
  ) AS v
  WHERE sm.id = _material_id;

  UPDATE public.study_materials
  SET upvotes = 0, downvotes = 0
  WHERE id = _material_id
    AND NOT EXISTS (
      SELECT 1
      FROM public.study_material_votes
      WHERE material_id = _material_id
    );

  RETURN QUERY
  SELECT
    sm.upvotes,
    sm.downvotes,
    (sm.upvotes - sm.downvotes) AS score,
    _new_user_vote
  FROM public.study_materials sm
  WHERE sm.id = _material_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.vote_study_material(uuid, smallint) TO authenticated;
