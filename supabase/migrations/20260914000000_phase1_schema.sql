-- =============================================================================
-- Migration: Phase 1 Core Data Model
-- Specification: IMPLEMENTATION_PLAN.md §0.2, §0.3, §0.4
-- Stack: PostgreSQL / Supabase
-- =============================================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =============================================================================
-- 1. ENUMS & TYPES
-- =============================================================================

DO $$ BEGIN
    CREATE TYPE checkin_type AS ENUM ('morning', 'evening', 'manual');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE relief_technique AS ENUM ('square_breathing', 'grounding_54321', 'micro_meditation');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE request_status AS ENUM ('pending', 'processing', 'completed', 'failed');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE wearable_provider AS ENUM ('fitbit', 'apple_health', 'google_fit');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- =============================================================================
-- 2. TABLES
-- =============================================================================

-- 2.1 USERS
-- Integrates with Supabase Auth (auth.users) while maintaining application metadata
CREATE TABLE IF NOT EXISTS public.users (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT UNIQUE NOT NULL,
    auth_provider_id TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    locale TEXT NOT NULL DEFAULT 'en',
    consent_version_accepted TEXT NOT NULL,
    data_retention_pref TEXT NOT NULL DEFAULT 'standard'
);

-- 2.2 BASELINE_PROFILE
-- Onboarding answers (5-6 questions). Column-level encryption support via pgcrypto.
CREATE TABLE IF NOT EXISTS public.baseline_profile (
    user_id UUID PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
    answers_json JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 2.3 CHECKINS
-- Morning, evening, or in-the-moment manual triggers
CREATE TABLE IF NOT EXISTS public.checkins (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    type checkin_type NOT NULL,
    mood_score INT NOT NULL CHECK (mood_score >= 1 AND mood_score <= 10),
    free_text TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 2.4 STRESS_INDEX_DAILY
-- Recalculated stress score per day with source check-in references
CREATE TABLE IF NOT EXISTS public.stress_index_daily (
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    score NUMERIC(4, 2) NOT NULL CHECK (score >= 0.00 AND score <= 100.00),
    computed_from JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    PRIMARY KEY (user_id, date)
);

-- 2.5 RELIEF_SESSIONS
-- Guided breathing, grounding, or micro-meditation sessions
CREATE TABLE IF NOT EXISTS public.relief_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    checkin_id UUID REFERENCES public.checkins(id) ON DELETE SET NULL,
    technique relief_technique NOT NULL,
    started_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    completed_at TIMESTAMPTZ,
    self_reported_relief INT CHECK (self_reported_relief >= 1 AND self_reported_relief <= 5)
);

-- 2.6 CRISIS_EVENTS
-- SAFETY CRITICAL: Append-only log. Never read/joined by gamification features.
-- Unauthenticated triggers allowed so safety pathways are never blocked by login friction.
CREATE TABLE IF NOT EXISTS public.crisis_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
    triggered_by TEXT NOT NULL, -- checkin_id or raw trigger excerpt
    detector_version TEXT NOT NULL,
    resources_shown_json JSONB NOT NULL,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 2.7 CONSENT_LOG
-- Append-only audit log for consent grants and revocations
CREATE TABLE IF NOT EXISTS public.consent_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    consent_type TEXT NOT NULL,
    version TEXT NOT NULL,
    granted_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    revoked_at TIMESTAMPTZ
);

-- 2.8 DATA_EXPORT_REQUESTS
-- Asynchronous user data export requests
CREATE TABLE IF NOT EXISTS public.data_export_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    status request_status NOT NULL DEFAULT 'pending',
    requested_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    completed_at TIMESTAMPTZ
);

-- 2.9 DATA_DELETION_REQUESTS
-- Double-opt-in irreversible user deletion requests
CREATE TABLE IF NOT EXISTS public.data_deletion_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    status request_status NOT NULL DEFAULT 'pending',
    requested_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    completed_at TIMESTAMPTZ
);

-- 2.10 WEARABLE_CONNECTIONS (Phase 1 Optional Wearable Support)
-- Stores connection metadata only; zero wearables required for app operation
CREATE TABLE IF NOT EXISTS public.wearable_connections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    provider wearable_provider NOT NULL,
    connected_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    last_synced_at TIMESTAMPTZ,
    is_active BOOLEAN NOT NULL DEFAULT true,
    UNIQUE (user_id, provider)
);

-- =============================================================================
-- 3. SAFETY & APPEND-ONLY ENFORCEMENT (TRIGGERS)
-- =============================================================================

-- Guardrail 1: crisis_events must be strictly append-only (no UPDATE or DELETE allowed)
CREATE OR REPLACE FUNCTION prevent_crisis_events_mutation()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'Safety Guardrail Violation: crisis_events is strictly append-only and cannot be updated or deleted.';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_crisis_events_append_only ON public.crisis_events;
CREATE TRIGGER trg_crisis_events_append_only
BEFORE UPDATE OR DELETE ON public.crisis_events
FOR EACH ROW EXECUTE FUNCTION prevent_crisis_events_mutation();

-- Guardrail 2: consent_log is an immutable audit trail
CREATE OR REPLACE FUNCTION prevent_consent_log_mutation()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'UPDATE' AND (OLD.revoked_at IS NULL AND NEW.revoked_at IS NOT NULL) THEN
        -- Allow recording revocation timestamp once
        IF OLD.user_id = NEW.user_id AND OLD.consent_type = NEW.consent_type AND OLD.version = NEW.version AND OLD.granted_at = NEW.granted_at THEN
            RETURN NEW;
        END IF;
    END IF;
    RAISE EXCEPTION 'Audit Trail Violation: consent_log entries cannot be modified or deleted once recorded.';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_consent_log_immutable ON public.consent_log;
CREATE TRIGGER trg_consent_log_immutable
BEFORE UPDATE OR DELETE ON public.consent_log
FOR EACH ROW EXECUTE FUNCTION prevent_consent_log_mutation();

-- =============================================================================
-- 4. PERFORMANCE INDEXES
-- =============================================================================

CREATE INDEX IF NOT EXISTS idx_checkins_user_created ON public.checkins (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_stress_index_user_date ON public.stress_index_daily (user_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_relief_sessions_user ON public.relief_sessions (user_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_crisis_events_user_time ON public.crisis_events (user_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_consent_log_user ON public.consent_log (user_id, granted_at DESC);
CREATE INDEX IF NOT EXISTS idx_data_export_user_status ON public.data_export_requests (user_id, status);
CREATE INDEX IF NOT EXISTS idx_data_deletion_user_status ON public.data_deletion_requests (user_id, status);

-- =============================================================================
-- 5. ROW LEVEL SECURITY (RLS) POLICIES
-- =============================================================================

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.baseline_profile ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.checkins ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stress_index_daily ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.relief_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crisis_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.consent_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.data_export_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.data_deletion_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wearable_connections ENABLE ROW LEVEL SECURITY;

-- Standard user isolation policies
CREATE POLICY "Users can view their own profile" ON public.users FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update their own profile" ON public.users FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can manage their baseline" ON public.baseline_profile FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can manage their checkins" ON public.checkins FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can view their stress index" ON public.stress_index_daily FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Service can manage stress index" ON public.stress_index_daily FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can manage their relief sessions" ON public.relief_sessions FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can manage wearable connections" ON public.wearable_connections FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can view their consent log" ON public.consent_log FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their consent log" ON public.consent_log FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view and request data export" ON public.data_export_requests FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can view and request data deletion" ON public.data_deletion_requests FOR ALL USING (auth.uid() = user_id);

-- Crisis events RLS:
-- Anyone (even anonymous/unauthenticated) can insert a crisis event to ensure resources are logged
CREATE POLICY "Anyone can insert crisis events" ON public.crisis_events FOR INSERT WITH CHECK (true);
-- Users can view their own crisis events if logged in, but no one can update/delete
CREATE POLICY "Users can view own crisis events" ON public.crisis_events FOR SELECT USING (auth.uid() = user_id);
