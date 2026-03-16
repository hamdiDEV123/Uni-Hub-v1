-- Ensure product_images storage bucket and policies are present.
-- Idempotent migration.

INSERT INTO storage.buckets (id, name, public)
VALUES ('product_images', 'product_images', true)
ON CONFLICT (id) DO UPDATE
SET public = EXCLUDED.public;

DROP POLICY IF EXISTS "product_images_public_read" ON storage.objects;
CREATE POLICY "product_images_public_read"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'product_images');

DROP POLICY IF EXISTS "product_images_auth_upload_own_folder" ON storage.objects;
CREATE POLICY "product_images_auth_upload_own_folder"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'product_images'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

DROP POLICY IF EXISTS "product_images_auth_update_own_folder" ON storage.objects;
CREATE POLICY "product_images_auth_update_own_folder"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'product_images'
  AND auth.uid()::text = (storage.foldername(name))[1]
)
WITH CHECK (
  bucket_id = 'product_images'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

DROP POLICY IF EXISTS "product_images_auth_delete_own_folder" ON storage.objects;
CREATE POLICY "product_images_auth_delete_own_folder"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'product_images'
  AND auth.uid()::text = (storage.foldername(name))[1]
);
