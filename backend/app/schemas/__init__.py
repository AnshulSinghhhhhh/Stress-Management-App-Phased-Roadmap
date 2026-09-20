"""Pydantic request and response schemas for Phase 1 endpoints."""
from typing import Optional, List, Dict, Any
from datetime import datetime, date
from pydantic import BaseModel, Field, EmailStr, ConfigDict, model_validator

# User & Baseline
class UserCreate(BaseModel):
    id: Optional[str] = None
    email: EmailStr
    consent_version_accepted: str = "1.0.0"
    locale: str = "en"
    data_retention_pref: str = "standard"

class UserResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    email: str
    locale: str
    consent_version_accepted: str
    data_retention_pref: str
    created_at: datetime

class BaselineCreate(BaseModel):
    user_id: Optional[str] = "demo_user"
    answers: Dict[str, Any]

class BaselineResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    user_id: str
    answers_json: Dict[str, Any]
    created_at: datetime
    status: Optional[str] = None

class BaselineSnapshotCreate(BaseModel):
    user_id: Optional[str] = "demo_user"
    scale_name: str = "who5_adapted"
    answers: Dict[str, Any]

class BaselineSnapshotResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    user_id: str
    version: str
    scale_name: str
    score_normalized: float
    answers_json: Dict[str, Any]
    created_at: datetime

# Checkins
class CheckinCreate(BaseModel):
    user_id: Optional[str] = "demo_user"
    idempotency_key: Optional[str] = Field(None, description="Client idempotency UUID to prevent duplicate writes")
    type: str = Field("morning", description="Open label: 'morning', 'afternoon', 'evening', 'night', 'custom', 'manual'")
    mood_score: int = Field(..., ge=1, le=10, description="1 to 10 mood score")
    free_text: Optional[str] = None
    emotional_tags: Optional[List[str]] = Field(default_factory=list)
    tags: Optional[List[str]] = None
    trigger_category: Optional[str] = Field(None, description="One of the 7 pinned trigger categories from §2.0")
    trigger_categories: Optional[List[str]] = Field(default_factory=list, description="Optional multiple trigger categories from §2.0")
    user_tz_offset_minutes: Optional[int] = Field(0, description="User timezone offset in minutes from UTC")

    @model_validator(mode="after")
    def populate_emotional_tags(self):
        if self.tags and not self.emotional_tags:
            self.emotional_tags = self.tags
        return self

class CheckinResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    user_id: str
    idempotency_key: Optional[str] = None
    type: str
    mood_score: int
    free_text: Optional[str] = None
    emotional_tags: Optional[List[str]] = None
    created_at: datetime
    crisis_response: Optional[Dict[str, Any]] = None
    daily_stress_score: Optional[float] = None
    derived_stress_score: Optional[float] = None
    confidence: Optional[float] = None
    circadian_bucket: Optional[str] = None
    probing_question: Optional[str] = None
    detected_feelings: Optional[List[str]] = Field(default_factory=list)
    detected_feelings_confidence: Optional[float] = None
    detected_feelings_source: Optional[str] = None
    trigger_categories: Optional[List[str]] = Field(default_factory=list)

class CheckinFeelingsUpdate(BaseModel):
    feelings: List[str]

# Calibrated Stress & Insights
class ContributingFactor(BaseModel):
    category: str
    contribution_pct: float
    weighted_frequency: float
    mean_stress_present: float
    mean_stress_absent: float
    lift: float
    evidence_checkin_ids: List[str]
    deterministic_reason: str

class CalibratedStressIndicatorResponse(BaseModel):
    user_id: str
    status: str # 'calibrating', 'preliminary', 'calibrated'
    current_score: float
    confidence_score: float
    effective_sample_size: float
    distinct_days: int
    minimum_n_met: bool
    trend_direction: Optional[str] = None # 'rising', 'stable', 'easing', None
    trend_slope: Optional[float] = None
    status_copy: str
    contributing_factors: List[ContributingFactor] = Field(default_factory=list)
    recommended_action: Dict[str, Any]

class LongitudinalTrendPoint(BaseModel):
    date: date
    score: float
    confidence: float
    checkin_count: int
    label: str

class LongitudinalTrendResponse(BaseModel):
    user_id: str
    range: str
    status: str
    minimum_n_met: bool
    distinct_days: int
    points: List[LongitudinalTrendPoint]

# Consent Schemas
class ConsentItem(BaseModel):
    consent_type: str
    granted: bool
    version: str
    granted_at: Optional[datetime] = None
    revoked_at: Optional[datetime] = None

class ConsentStatusResponse(BaseModel):
    user_id: str
    active_consents: Dict[str, bool]
    history: List[ConsentItem]

class ConsentGrantRequest(BaseModel):
    user_id: Optional[str] = "demo_user"
    consent_type: str = Field(..., description="e.g. 'terms_and_privacy', 'wearable_data', 'anonymous_analytics'")
    version: str = "2.0.0"

class ConsentRevokeRequest(BaseModel):
    user_id: Optional[str] = "demo_user"
    consent_type: str


# Relief
class ReliefSessionStart(BaseModel):
    user_id: Optional[str] = "demo_user"
    technique: str = Field(..., description="'square_breathing', 'grounding_54321', 'micro_meditation'")
    checkin_id: Optional[str] = None

class ReliefSessionUpdate(BaseModel):
    self_reported_relief: int = Field(..., ge=1, le=5)

class ReliefSessionResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    user_id: str
    technique: str
    checkin_id: Optional[str] = None
    started_at: datetime
    completed_at: Optional[datetime] = None
    self_reported_relief: Optional[int] = None

# Crisis
class CrisisCheckRequest(BaseModel):
    user_id: Optional[str] = None
    text: Optional[str] = ""
    is_manual: Optional[bool] = False

class CrisisCheckResponse(BaseModel):
    model_config = ConfigDict(protected_namespaces=())
    crisis_detected: bool
    detector_version: str
    detection_latency_ms: float
    triggered_by: Optional[str] = None
    copy: Optional[Dict[str, str]] = None
    resources: Optional[List[Dict[str, Any]]] = None

# Stress Index
class DailyStressPoint(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    date: date
    score: float
    computed_from_count: int
    computed_from: Optional[List[Dict[str, Any]]] = None

# Data Export & Delete
class DataExportRequestModel(BaseModel):
    user_id: Optional[str] = "demo_user"

class DataExportResponse(BaseModel):
    export_id: str
    status: str
    data: Optional[Dict[str, Any]] = None
    requested_at: Optional[datetime] = None

class DataDeleteRequest(BaseModel):
    user_id: Optional[str] = "demo_user"
    confirm: bool = True

class DataDeleteResponse(BaseModel):
    status: str
    message: str
    user_id: str

# Integrations / Wearable
class WearableConnectRequest(BaseModel):
    user_id: Optional[str] = "demo_user"
    provider: str = Field(..., description="'fitbit', 'apple_health', or 'google_fit'")

class WearableConnectionResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    user_id: str
    provider: str
    is_active: bool
    connected_at: datetime
    last_synced_at: Optional[datetime] = None

class WearableStatusResponse(BaseModel):
    user_id: str
    connected: bool
    connections: List[WearableConnectionResponse]


# ─── Phase 2 §2.0: Trigger Tags ─────────────────────────────────────────────
VALID_TRIGGER_CATEGORIES = [
    "work",
    "financial",
    "relationship",
    "health",
    "sleep",
    "social_loneliness",
    "identity",
]

class TriggerTagResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    checkin_id: str
    user_id: str
    category: str
    confidence: float
    source: str  # 'embedding', 'nim', 'user_corrected'
    branch: Optional[str] = None
    created_at: datetime

class TriggerTagCorrection(BaseModel):
    category: str = Field(..., description="One of the 7 trigger categories")

class TriggerSummary(BaseModel):
    category: str
    count: int
    avg_confidence: float
    sources: List[str]
