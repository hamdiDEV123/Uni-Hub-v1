-- Campus Feed hotfix
-- Fix hashtag post publishing by allowing trigger-based sync under RLS.

ALTER TABLE public.campus_post_hashtags ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "campus hashtags insert own_or_admin" ON public.campus_post_hashtags;
CREATE POLICY "campus hashtags insert own_or_admin"
  ON public.campus_post_hashtags
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.campus_posts p
      WHERE p.id = campus_post_hashtags.post_id
        AND (
          p.author_id = auth.uid()
          OR public.has_role(auth.uid(), 'admin')
        )
    )
  );

DROP POLICY IF EXISTS "campus hashtags delete own_or_admin" ON public.campus_post_hashtags;
CREATE POLICY "campus hashtags delete own_or_admin"
  ON public.campus_post_hashtags
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.campus_posts p
      WHERE p.id = campus_post_hashtags.post_id
        AND (
          p.author_id = auth.uid()
          OR public.has_role(auth.uid(), 'admin')
        )
    )
  );