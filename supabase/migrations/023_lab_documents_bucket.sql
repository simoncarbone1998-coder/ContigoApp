-- Create lab-documents storage bucket (private) if it doesn't exist
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'lab-documents',
  'lab-documents',
  false,
  10485760,  -- 10 MB
  ARRAY['application/pdf']
)
ON CONFLICT (id) DO NOTHING;

-- Lab users can upload their own documents
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'lab_docs_insert'
  ) THEN
    CREATE POLICY "lab_docs_insert"
    ON storage.objects FOR INSERT
    TO authenticated
    WITH CHECK (
      bucket_id = 'lab-documents'
      AND EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'laboratory')
    );
  END IF;
END $$;

-- Lab users can update (upsert) their own documents
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'lab_docs_update'
  ) THEN
    CREATE POLICY "lab_docs_update"
    ON storage.objects FOR UPDATE
    TO authenticated
    USING (
      bucket_id = 'lab-documents'
      AND EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'laboratory')
    );
  END IF;
END $$;

-- Lab users and admins can read documents
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'lab_docs_select'
  ) THEN
    CREATE POLICY "lab_docs_select"
    ON storage.objects FOR SELECT
    TO authenticated
    USING (
      bucket_id = 'lab-documents'
      AND EXISTS (
        SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('laboratory', 'admin')
      )
    );
  END IF;
END $$;
