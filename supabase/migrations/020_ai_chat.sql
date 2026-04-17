-- ── 020_ai_chat.sql ───────────────────────────────────────────────────────────
-- RAG-powered chat widget: documents, chunks, config, leads + Storage bucket

-- ── 1. chat_documents ─────────────────────────────────────────────────────────
CREATE TABLE chat_documents (
  id           uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  name         text    NOT NULL,
  file_url     text    NOT NULL,
  file_name    text    NOT NULL,
  file_type    text    NOT NULL,
  file_size    text,
  content_text text,
  chunk_count  integer NOT NULL DEFAULT 0,
  status       text    NOT NULL DEFAULT 'processing'
               CHECK (status IN ('processing', 'ready', 'error')),
  uploaded_by  uuid    REFERENCES profiles(id),
  created_at   timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE chat_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "chat_documents_admin"
  ON chat_documents FOR ALL
  USING (is_admin());

CREATE POLICY "chat_documents_public_read"
  ON chat_documents FOR SELECT
  USING (status = 'ready');

-- ── 2. chat_document_chunks ───────────────────────────────────────────────────
CREATE TABLE chat_document_chunks (
  id          uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid    NOT NULL REFERENCES chat_documents(id) ON DELETE CASCADE,
  chunk_index integer NOT NULL,
  content     text    NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE chat_document_chunks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "chat_document_chunks_public_read"
  ON chat_document_chunks FOR SELECT
  USING (true);

CREATE POLICY "chat_document_chunks_admin"
  ON chat_document_chunks FOR ALL
  USING (is_admin());

-- ── 3. chat_config ────────────────────────────────────────────────────────────
CREATE TABLE chat_config (
  id            uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  system_prompt text    NOT NULL,
  is_active     boolean NOT NULL DEFAULT true,
  updated_by    uuid    REFERENCES profiles(id),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE chat_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "chat_config_admin"
  ON chat_config FOR ALL
  USING (is_admin());

CREATE POLICY "chat_config_public_read"
  ON chat_config FOR SELECT
  USING (is_active = true);

-- ── 4. chat_leads ─────────────────────────────────────────────────────────────
CREATE TABLE chat_leads (
  id           uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  name         text    NOT NULL,
  email        text    NOT NULL,
  phone        text,
  conversation jsonb,
  created_at   timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE chat_leads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "chat_leads_admin"
  ON chat_leads FOR ALL
  USING (is_admin());

-- Allow anonymous/public users to submit leads from the landing page
CREATE POLICY "chat_leads_public_insert"
  ON chat_leads FOR INSERT
  WITH CHECK (true);

-- ── 5. Storage bucket ─────────────────────────────────────────────────────────
INSERT INTO storage.buckets (id, name, public)
  VALUES ('chat-documents', 'chat-documents', false)
  ON CONFLICT (id) DO NOTHING;

CREATE POLICY "chat_docs_admin_upload"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'chat-documents' AND is_admin());

CREATE POLICY "chat_docs_admin_delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'chat-documents' AND is_admin());

CREATE POLICY "chat_docs_admin_select"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'chat-documents' AND is_admin());

-- ── 6. Seed default chat_config ───────────────────────────────────────────────
INSERT INTO chat_config (system_prompt, is_active) VALUES (
$$Eres un asistente de Contigo, una plataforma de salud colombiana. Tu rol es responder preguntas sobre el plan de salud de Contigo basándote ÚNICAMENTE en los documentos proporcionados.

REGLAS:
- Solo responde sobre lo que está en los documentos
- Si no sabes algo, di "No tengo información sobre eso en este momento. Te recomiendo hablar con un asesor."
- Nunca inventes información sobre precios, coberturas o condiciones que no estén en los documentos
- Sé amable, conciso y profesional
- Responde en el mismo idioma que usa el usuario
- Si el usuario escribe en inglés, responde en inglés
- Si escribe en español, responde en español
- Máximo 3 párrafos por respuesta
- No discutas temas fuera del plan de Contigo$$,
  true
);
