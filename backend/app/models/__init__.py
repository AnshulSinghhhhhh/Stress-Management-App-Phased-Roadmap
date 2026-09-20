"""SQLAlchemy models for Phase 1 + Phase 2 §2.0 Core Data Model.
Per IMPLEMENTATION_PLAN.md §0.2 and §2.0.

Phase 2 additions:
  - Checkin.embedding: stores 384-dim vector (JSON list for SQLite, pgvector for Postgres)
  - TriggerTag: per-checkin trigger taxonomy classification
"""
from datetime import datetime, timezone
import uuid
from sqlalchemy import Column, String, Integer, Float, DateTime, Date, ForeignKey, JSON, Boolean, Text
from sqlalchemy.orm import relationship
from app.core.database import Base

def utc_now():
    return datetime.now(timezone.utc)

class User(Base):
    __tablename__ = "users"
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    email = Column(String(255), unique=True, nullable=False, index=True)
    auth_provider_id = Column(String(255), nullable=True)
    created_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)
    locale = Column(String(10), default="en", nullable=False)
    consent_version_accepted = Column(String(50), default="1.0.0", nullable=False)
    data_retention_pref = Column(String(50), default="standard", nullable=False)

    baseline = relationship("BaselineProfile", back_populates="user", uselist=False, cascade="all, delete-orphan")
    baseline_snapshots = relationship("BaselineSnapshot", back_populates="user", cascade="all, delete-orphan")
    checkins = relationship("Checkin", back_populates="user", cascade="all, delete-orphan")
    daily_scores = relationship("DailyStressIndex", back_populates="user", cascade="all, delete-orphan")
    stress_trends = relationship("StressTrendsLongitudinal", back_populates="user", cascade="all, delete-orphan")
    relief_sessions = relationship("ReliefSession", back_populates="user", cascade="all, delete-orphan")

class BaselineProfile(Base):
    __tablename__ = "baseline_profile"
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    answers_json = Column(JSON, nullable=False)
    created_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)

    user = relationship("User", back_populates="baseline")

class BaselineSnapshot(Base):
    """Longitudinal Baseline Snapshot (Periodic Recalibration).
    Modeled on WHO-5 Well-Being Index + Cohen Coping Self-Efficacy dimensions.
    """
    __tablename__ = "baseline_snapshots"
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    version = Column(String(50), default="2.0.0", nullable=False)
    scale_name = Column(String(50), default="who5_adapted", nullable=False)
    score_normalized = Column(Float, nullable=False) # 0.00 to 100.00
    answers_json = Column(JSON, nullable=False)
    created_at = Column(DateTime(timezone=True), default=utc_now, nullable=False, index=True)

    user = relationship("User", back_populates="baseline_snapshots")

class Checkin(Base):
    __tablename__ = "checkins"
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    idempotency_key = Column(String(36), unique=True, default=lambda: str(uuid.uuid4()), nullable=False, index=True)
    type = Column(String(50), nullable=False) # Open label: 'morning', 'afternoon', 'evening', 'night', 'custom', 'manual'
    mood_score = Column(Integer, nullable=False) # 1 to 10
    free_text = Column(Text, nullable=True)
    emotional_tags = Column(JSON, nullable=True, default=list)
    # Phase 2 §2.0: 384-dim embedding from all-MiniLM-L6-v2.
    # Stored as JSON list in SQLite; as vector(384) in Postgres via migration.
    # One embedding serves both trigger classification AND pgvector RAG retrieval.
    embedding = Column(JSON, nullable=True)
    embedding_model_version = Column(String(50), default="all-MiniLM-L6-v2-v1", nullable=False)
    questionnaire_version = Column(String(50), default="2.0.0", nullable=False)
    scale_version = Column(String(50), default="2.0.0", nullable=False)
    user_tz_offset_minutes = Column(Integer, default=0, nullable=False)
    created_at = Column(DateTime(timezone=True), default=utc_now, nullable=False, index=True)

    user = relationship("User", back_populates="checkins")
    relief_sessions = relationship("ReliefSession", back_populates="checkin")
    trigger_tags = relationship("TriggerTag", back_populates="checkin", cascade="all, delete-orphan")
    features = relationship("CheckinFeaturesDerived", back_populates="checkin", uselist=False, cascade="all, delete-orphan")

    @property
    def trigger_categories(self) -> list:
        if not self.trigger_tags:
            return []
        return [t.category for t in self.trigger_tags]

class CheckinFeaturesDerived(Base):
    """Per-checkin derived indicators & ML feature layer."""
    __tablename__ = "checkin_features_derived"
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    checkin_id = Column(String(36), ForeignKey("checkins.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    derived_stress_score = Column(Float, nullable=False)
    baseline_delta = Column(Float, nullable=True)
    circadian_bucket = Column(String(20), default="day", nullable=False)
    confidence = Column(Float, default=1.0, nullable=False)
    model_version = Column(String(50), default="calibrated_v2", nullable=False)
    created_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)

    checkin = relationship("Checkin", back_populates="features")

class StressTrendsLongitudinal(Base):
    """Calibrated rolling trends & minimum-N tracking."""
    __tablename__ = "stress_trends_longitudinal"
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    date = Column(Date, nullable=False, index=True)
    weighted_mean = Column(Float, nullable=False)
    confidence = Column(Float, nullable=False)
    n_eff = Column(Float, nullable=False)
    distinct_days_count = Column(Integer, nullable=False)
    trend_slope = Column(Float, nullable=True)
    status = Column(String(20), default="calibrating", nullable=False) # 'calibrating', 'preliminary', 'calibrated'
    contributing_factors_json = Column(JSON, default=list, nullable=False)
    created_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)

    user = relationship("User", back_populates="stress_trends")


class DailyStressIndex(Base):
    __tablename__ = "stress_index_daily"
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    date = Column(Date, primary_key=True, index=True)
    score = Column(Float, nullable=False)
    computed_from = Column(JSON, default=list, nullable=False)
    created_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)

    user = relationship("User", back_populates="daily_scores")

class ReliefSession(Base):
    __tablename__ = "relief_sessions"
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    checkin_id = Column(String(36), ForeignKey("checkins.id", ondelete="SET NULL"), nullable=True)
    technique = Column(String(50), nullable=False) # 'square_breathing', 'grounding_54321', 'micro_meditation'
    started_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)
    completed_at = Column(DateTime(timezone=True), nullable=True)
    self_reported_relief = Column(Integer, nullable=True) # 1 to 5

    user = relationship("User", back_populates="relief_sessions")
    checkin = relationship("Checkin", back_populates="relief_sessions")

class CrisisEvent(Base):
    """SAFETY CRITICAL: Append-only log. Never read/joined by gamification features."""
    __tablename__ = "crisis_events"
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String(36), nullable=True, index=True) # Nullable for anonymous/unauthenticated triggers
    triggered_by = Column(String(255), nullable=False)
    detector_version = Column(String(50), nullable=False)
    resources_shown_json = Column(JSON, nullable=False)
    timestamp = Column(DateTime(timezone=True), default=utc_now, nullable=False, index=True)

class ConsentLog(Base):
    __tablename__ = "consent_log"
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    consent_type = Column(String(100), nullable=False)
    version = Column(String(50), nullable=False)
    granted_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)
    revoked_at = Column(DateTime(timezone=True), nullable=True)

class DataExportRequest(Base):
    __tablename__ = "data_export_requests"
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    status = Column(String(20), default="pending", nullable=False)
    requested_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)
    completed_at = Column(DateTime(timezone=True), nullable=True)

class DataDeletionRequest(Base):
    __tablename__ = "data_deletion_requests"
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    status = Column(String(20), default="pending", nullable=False)
    requested_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)
    completed_at = Column(DateTime(timezone=True), nullable=True)

class WearableConnection(Base):
    __tablename__ = "wearable_connections"
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    provider = Column(String(50), nullable=False)
    connected_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)
    last_synced_at = Column(DateTime(timezone=True), nullable=True)
    is_active = Column(Boolean, default=True, nullable=False)

# ─── Phase 2 §2.0: Trigger Tag ──────────────────────────────────────────────
class TriggerTag(Base):
    """Per-checkin trigger taxonomy classification.
    source: 'embedding' (local classifier), 'nim' (NIM fallback), 'user_corrected'.
    branch: 'actionable' | 'adaptive' | None (set later by user).
    """
    __tablename__ = "trigger_tags"
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    checkin_id = Column(String(36), ForeignKey("checkins.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(String(36), nullable=False, index=True)
    category = Column(String(50), nullable=False)
    confidence = Column(Float, nullable=False, default=0.0)
    source = Column(String(20), nullable=False, default="embedding")  # 'embedding', 'nim', 'user_corrected'
    branch = Column(String(20), nullable=True)  # 'actionable', 'adaptive', or None
    created_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)

    checkin = relationship("Checkin", back_populates="trigger_tags")
