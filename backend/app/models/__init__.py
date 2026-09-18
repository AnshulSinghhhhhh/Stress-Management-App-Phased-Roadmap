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
    checkins = relationship("Checkin", back_populates="user", cascade="all, delete-orphan")
    daily_scores = relationship("DailyStressIndex", back_populates="user", cascade="all, delete-orphan")
    relief_sessions = relationship("ReliefSession", back_populates="user", cascade="all, delete-orphan")

class BaselineProfile(Base):
    __tablename__ = "baseline_profile"
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    answers_json = Column(JSON, nullable=False)
    created_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)

    user = relationship("User", back_populates="baseline")

class Checkin(Base):
    __tablename__ = "checkins"
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    type = Column(String(20), nullable=False) # 'morning', 'evening', 'manual'
    mood_score = Column(Integer, nullable=False) # 1 to 10
    free_text = Column(Text, nullable=True)
    emotional_tags = Column(JSON, nullable=True, default=list)
    # Phase 2 §2.0: 384-dim embedding from all-MiniLM-L6-v2.
    # Stored as JSON list in SQLite; as vector(384) in Postgres via migration.
    # One embedding serves both trigger classification AND pgvector RAG retrieval.
    embedding = Column(JSON, nullable=True)
    created_at = Column(DateTime(timezone=True), default=utc_now, nullable=False, index=True)

    user = relationship("User", back_populates="checkins")
    relief_sessions = relationship("ReliefSession", back_populates="checkin")
    trigger_tags = relationship("TriggerTag", back_populates="checkin", cascade="all, delete-orphan")

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
