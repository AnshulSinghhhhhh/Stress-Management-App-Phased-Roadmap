-- =============================================================================
-- Migration: Phase 2 v2 Longitudinal Schema, Baseline Snapshots & Idempotency
-- Specification: IMPLEMENTATION_PLAN.md Section 4
-- =============================================================================

-- 1. Alter checkins table for idempotency, open-label type, emotional tags, and version metadata
ALTER TABLE public.checkins ADD COLUMN IF NOT EXISTS idempotency_key UUID DEFAULT gen_random_uuid();
CREATE UNIQUE INDEX IF NOT EXISTS idx_checkins_idempotency_key ON public.checkins(idempotency_key);

ALTER TABLE public.checkins ADD COLUMN IF NOT EXISTS emotional_tags JSONB DEFAULT '[]'::jsonb;
ALTER TABLE public.checkins ADD COLUMN IF NOT EXISTS embedding_model_version TEXT DEFAULT 'all-MiniLM-L6-v2-v1';
ALTER TABLE public.checkins ADD COLUMN IF NOT EXISTS questionnaire_version TEXT DEFAULT '2.0.0';
ALTER TABLE public.checkins ADD COLUMN IF NOT EXISTS scale_version TEXT DEFAULT '2.0.0';
ALTER TABLE public.checkins ADD COLUMN IF NOT EXISTS user_tz_offset_minutes INT DEFAULT 0;

-- Drop checkin_type constraint if enforced on checkin_type column to allow open labels
-- (PostgreSQL permits altering column to TEXT)
ALTER TABLE public.checkins ALTER COLUMN type TYPE TEXT;

-- 2. Baseline Snapshots (Longitudinal Baseline & Periodic Recalibration)
CREATE TABLE IF NOT EXISTS public.baseline_snapshots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    version TEXT NOT NULL DEFAULT '2.0.0',
    scale_name TEXT NOT NULL DEFAULT 'who5_adapted',
    score_normalized NUMERIC(5, 2) NOT NULL CHECK (score_normalized >= 0.00 AND score_normalized <= 100.00),
    answers_json JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);
CREATE INDEX IF NOT EXISTS idx_baseline_snapshots_user ON public.baseline_snapshots(user_id, created_at DESC);
ALTER TABLE public.baseline_snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY baseline_snapshots_user_isolation ON public.baseline_snapshots FOR ALL USING (auth.uid() = user_id);

-- 3. Checkin Features Derived (Per-checkin ML / derived indicator layer)
CREATE TABLE IF NOT EXISTS public.checkin_features_derived (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    checkin_id UUID NOT NULL REFERENCES public.checkins(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    derived_stress_score NUMERIC(5, 2) NOT NULL,
    baseline_delta NUMERIC(5, 2),
    circadian_bucket TEXT NOT NULL DEFAULT 'day',
    confidence NUMERIC(4, 3) NOT NULL DEFAULT 1.000,
    model_version TEXT NOT NULL DEFAULT 'calibrated_v2',
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);
CREATE INDEX IF NOT EXISTS idx_features_checkin ON public.checkin_features_derived(checkin_id);
CREATE INDEX IF NOT EXISTS idx_features_user ON public.checkin_features_derived(user_id, created_at DESC);
ALTER TABLE public.checkin_features_derived ENABLE ROW LEVEL SECURITY;
CREATE POLICY checkin_features_user_isolation ON public.checkin_features_derived FOR ALL USING (auth.uid() = user_id);

-- 4. Stress Trends Longitudinal (Calibrated moving trends & minimum-N tracking)
CREATE TABLE IF NOT EXISTS public.stress_trends_longitudinal (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    weighted_mean NUMERIC(5, 2) NOT NULL,
    confidence NUMERIC(4, 3) NOT NULL,
    n_eff NUMERIC(6, 2) NOT NULL,
    distinct_days_count INT NOT NULL,
    trend_slope NUMERIC(5, 2),
    status TEXT NOT NULL DEFAULT 'calibrating',
    contributing_factors_json JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    UNIQUE(user_id, date)
);
CREATE INDEX IF NOT EXISTS idx_trends_user_date ON public.stress_trends_longitudinal(user_id, date DESC);
ALTER TABLE public.stress_trends_longitudinal ENABLE ROW LEVEL SECURITY;
CREATE POLICY stress_trends_user_isolation ON public.stress_trends_longitudinal FOR ALL USING (auth.uid() = user_id);

-- 5. Safe System Deletion & Anonymization (Fix Postgres Trigger Conflict)
-- Allows user anonymization in crisis_events and deletion in consent_log during double opt-in data wipes
CREATE OR REPLACE FUNCTION prevent_crisis_events_mutation()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'UPDATE' THEN
        -- Allow system anonymization (setting user_id to NULL on user deletion)
        IF OLD.user_id IS NOT NULL AND NEW.user_id IS NULL 
           AND OLD.triggered_by = NEW.triggered_by 
           AND OLD.detector_version = NEW.detector_version 
           AND OLD.timestamp = NEW.timestamp THEN
            RETURN NEW;
        END IF;
    END IF;
    RAISE EXCEPTION 'Safety Guardrail Violation: crisis_events is strictly append-only and cannot be altered.';
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION prevent_consent_log_mutation()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'UPDATE' AND (OLD.revoked_at IS NULL AND NEW.revoked_at IS NOT NULL) THEN
        IF OLD.user_id = NEW.user_id AND OLD.consent_type = NEW.consent_type AND OLD.version = NEW.version AND OLD.granted_at = NEW.granted_at THEN
            RETURN NEW;
        END IF;
    END IF;
    IF TG_OP = 'DELETE' THEN
        -- Allow user data erasure request
        RETURN OLD;
    END IF;
    RAISE EXCEPTION 'Audit Trail Violation: consent_log entries cannot be modified once recorded.';
END;
$$ LANGUAGE plpgsql;
