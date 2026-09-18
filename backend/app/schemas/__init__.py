"""Pydantic request and response schemas for Phase 1 endpoints."""
from typing import Optional, List, Dict, Any
from datetime import datetime, date
from pydantic import BaseModel, Field, EmailStr, ConfigDict

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

# Checkins
class CheckinCreate(BaseModel):
    user_id: Optional[str] = "demo_user"
    type: str = Field("morning", description="'morning', 'evening', or 'manual'")
    mood_score: int = Field(..., ge=1, le=10, description="1 to 10 mood score")
    free_text: Optional[str] = None
    emotional_tags: Optional[List[str]] = Field(default_factory=list)
    trigger_category: Optional[str] = Field(None, description="One of the 7 pinned trigger categories from §2.0")
    trigger_categories: Optional[List[str]] = Field(default_factory=list, description="Optional multiple trigger categories from §2.0")

class CheckinResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    user_id: str
    type: str
    mood_score: int
    free_text: Optional[str] = None
    emotional_tags: Optional[List[str]] = None
    created_at: datetime
    crisis_response: Optional[Dict[str, Any]] = None
    daily_stress_score: Optional[float] = None
    probing_question: Optional[str] = None

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
