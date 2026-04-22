-- Add document URL columns to profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS cedula_url                  text,
  ADD COLUMN IF NOT EXISTS diploma_pregrado_url        text,
  ADD COLUMN IF NOT EXISTS diploma_especializacion_url text;

-- Create doctor-documents private storage bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'doctor-documents',
  'doctor-documents',
  false,
  10485760,  -- 10 MB
  ARRAY['application/pdf', 'image/jpeg', 'image/jpg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- Doctors can upload their own documents
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'doctor_docs_insert'
  ) THEN
    CREATE POLICY "doctor_docs_insert"
    ON storage.objects FOR INSERT
    TO authenticated
    WITH CHECK (
      bucket_id = 'doctor-documents'
      AND EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'doctor')
    );
  END IF;
END $$;

-- Doctors can update (upsert) their own documents
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'doctor_docs_update'
  ) THEN
    CREATE POLICY "doctor_docs_update"
    ON storage.objects FOR UPDATE
    TO authenticated
    USING (
      bucket_id = 'doctor-documents'
      AND EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'doctor')
    );
  END IF;
END $$;

-- Doctors and admins can read documents
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'doctor_docs_select'
  ) THEN
    CREATE POLICY "doctor_docs_select"
    ON storage.objects FOR SELECT
    TO authenticated
    USING (
      bucket_id = 'doctor-documents'
      AND EXISTS (
        SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('doctor', 'admin')
      )
    );
  END IF;
END $$;
