-- Phase 2 §2.0: Enable pgvector, add embedding column to checkins, create trigger_tags table.
-- Per IMPLEMENTATION_PLAN.md §2.0:
--   - pgvector on existing Supabase Postgres (free, no new service).
--   - checkins.embedding stores 384-dim vector from all-MiniLM-L6-v2.
--   - trigger_tags stores per-checkin trigger classifications.

-- 1. Enable the pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- 2. Add embedding column to checkins (384 dimensions for all-MiniLM-L6-v2)
ALTER TABLE checkins ADD COLUMN IF NOT EXISTS embedding vector(384);

-- 3. Create index for cosine similarity retrieval scoped per-user
CREATE INDEX IF NOT EXISTS idx_checkins_embedding
  ON checkins USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 10);

-- 4. Trigger taxonomy table
-- source: 'embedding' (local classifier), 'nim' (NIM fallback), 'user_corrected'
CREATE TABLE IF NOT EXISTS trigger_tags (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  checkin_id  UUID NOT NULL REFERENCES checkins(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL,
  category    TEXT NOT NULL,
  confidence  REAL NOT NULL DEFAULT 0.0,
  source      TEXT NOT NULL DEFAULT 'embedding'
                CHECK (source IN ('embedding', 'nim', 'user_corrected')),
  branch      TEXT CHECK (branch IN ('actionable', 'adaptive', NULL)),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_trigger_tags_user_id ON trigger_tags(user_id);
CREATE INDEX IF NOT EXISTS idx_trigger_tags_checkin_id ON trigger_tags(checkin_id);
CREATE INDEX IF NOT EXISTS idx_trigger_tags_category ON trigger_tags(category);

-- 5. RLS policies for trigger_tags (mirror checkins RLS pattern)
ALTER TABLE trigger_tags ENABLE ROW LEVEL SECURITY;
CREATE POLICY trigger_tags_user_isolation ON trigger_tags FOR ALL USING (auth.uid() = user_id);

