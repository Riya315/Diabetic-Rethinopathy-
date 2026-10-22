"""
DrishtiCare - SQLAlchemy Database Models & Pydantic Validation Schemas
Defines schema for Patients, Screenings, Clinical Referrals, Offline Sync Queue, and Health Worker Auth.
"""

import os
import datetime
from typing import Optional, List, Dict, Any
from sqlalchemy import (
    create_engine, Column, Integer, String, Float, Boolean, DateTime, Text, text
)
from sqlalchemy.orm import declarative_base, sessionmaker, Session
from pydantic import BaseModel, ConfigDict, Field

from backend.app.config import settings

Base = declarative_base()


# ==========================================
# SQLAlchemy Database Models
# ==========================================

class UserDB(Base):
    """Health worker & clinical specialist authentication user model."""
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    username = Column(String(60), unique=True, index=True, nullable=False)
    email = Column(String(120), unique=True, index=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    full_name = Column(String(120), nullable=False)
    role = Column(String(30), default="health_worker")  # health_worker, ophthalmologist, admin
    clinic_location = Column(String(150), default="Primary Health Centre (PHC) Chittoor")
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=lambda: datetime.datetime.now(datetime.timezone.utc))


class PatientDB(Base):
    """Patient demographic and medical history record."""
    __tablename__ = "patients"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    user_id = Column(Integer, nullable=False, index=True)
    patient_code = Column(String(50), index=True, nullable=False)
    full_name = Column(String(120), nullable=False)
    age = Column(Integer, nullable=False)
    gender = Column(String(20), nullable=False)
    village = Column(String(120), nullable=False)
    diabetes_duration_years = Column(Float, default=0.0)
    phone = Column(String(30), nullable=True)
    consent_given = Column(Boolean, default=True)
    created_at = Column(DateTime, default=lambda: datetime.datetime.now(datetime.timezone.utc))


class ScreeningDB(Base):
    """AI Retinal Screening session storing dual-eye outputs and Grad-CAM explainability."""
    __tablename__ = "screenings"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    user_id = Column(Integer, nullable=False, index=True)
    screening_code = Column(String(50), index=True, nullable=False)
    patient_id = Column(Integer, nullable=False)
    patient_code = Column(String(50), nullable=False)
    eye = Column(String(10), default="both")  # left, right, both
    
    # Image file paths / keys
    left_image_path = Column(String(255), nullable=True)
    right_image_path = Column(String(255), nullable=True)
    left_gradcam_path = Column(String(255), nullable=True)
    right_gradcam_path = Column(String(255), nullable=True)
    
    # Per-eye individual diagnostics
    left_dr_grade = Column(Integer, nullable=True)
    right_dr_grade = Column(Integer, nullable=True)
    left_dr_grade_name = Column(String(80), nullable=True)
    right_dr_grade_name = Column(String(80), nullable=True)
    left_confidence = Column(Float, nullable=True)
    right_confidence = Column(Float, nullable=True)
    left_referable = Column(Boolean, nullable=True)
    right_referable = Column(Boolean, nullable=True)
    left_explanation = Column(Text, nullable=True)
    right_explanation = Column(Text, nullable=True)

    # OpenCV Quality Gatekeeper Results
    quality_passed = Column(Boolean, default=True)
    quality_issues = Column(Text, default="[]")
    quality_message = Column(Text, default="")
    
    # Overall/Aggregated AI Grading (Max severity between eyes)
    dr_grade = Column(Integer, default=0)
    dr_grade_name = Column(String(80), default="No Diabetic Retinopathy")
    referable = Column(Boolean, default=False)
    confidence = Column(Float, default=0.0)
    confidence_tier = Column(String(30), default="High Confidence")
    urgency_tier = Column(String(30), default="Routine")
    suggested_timeframe = Column(String(80), default="Annual screening")
    explanation_text = Column(Text, default="")
    lesion_summary = Column(Text, default="{}")
    
    # Screening Status
    status = Column(String(30), default="Completed")
    created_at = Column(DateTime, default=lambda: datetime.datetime.now(datetime.timezone.utc))


class ReferralDB(Base):
    """Clinical referral record for patients needing specialist ophthalmology care."""
    __tablename__ = "referrals"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    user_id = Column(Integer, nullable=False, index=True)
    referral_code = Column(String(50), index=True, nullable=False)
    patient_id = Column(Integer, nullable=False)
    patient_code = Column(String(50), nullable=False)
    patient_name = Column(String(120), nullable=False)
    screening_id = Column(Integer, nullable=False)
    dr_grade = Column(Integer, default=2)
    dr_grade_name = Column(String(80), default="Moderate NPDR")
    urgency = Column(String(30), default="Priority")
    target_facility = Column(String(150), default="District Eye Hospital, Tele-Ophthalmology Unit")
    referral_reason = Column(Text, default="")
    suggested_timeframe = Column(String(80), default="Within 30 days")
    notes = Column(Text, default="")
    status = Column(String(30), default="Pending")
    created_at = Column(DateTime, default=lambda: datetime.datetime.now(datetime.timezone.utc))


class SyncQueueDB(Base):
    """Offline-first synchronization tracking queue for rural frontline operations."""
    __tablename__ = "sync_queue"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    user_id = Column(Integer, nullable=False, index=True)
    entity_type = Column(String(50), nullable=False)
    entity_id = Column(String(50), nullable=False)
    payload_json = Column(Text, nullable=False)
    status = Column(String(30), default="Pending")
    retry_count = Column(Integer, default=0)
    error_message = Column(Text, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.datetime.now(datetime.timezone.utc))
    synced_at = Column(DateTime, nullable=True)


# ==========================================
# Database Connection & Engine Configuration
# ==========================================

if settings.database_url.startswith("sqlite"):
    db_file_path = settings.database_url.replace("sqlite:///", "")
    db_dir = os.path.dirname(os.path.abspath(db_file_path))
    if db_dir:
        os.makedirs(db_dir, exist_ok=True)
    engine = create_engine(settings.database_url, connect_args={"check_same_thread": False})
else:
    engine = create_engine(settings.database_url, pool_pre_ping=True)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def get_db():
    """FastAPI dependency for yielding database session."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db():
    """Create tables and apply lightweight schema migrations for per-user data isolation."""
    Base.metadata.create_all(bind=engine)
    _migrate_user_scoped_columns()
    _purge_unscoped_clinical_data()


def _migrate_user_scoped_columns():
    """Add user_id to existing SQLite tables when upgrading from older schemas."""
    if not settings.database_url.startswith("sqlite"):
        return
    with engine.connect() as conn:
        for table in ("patients", "screenings", "referrals", "sync_queue"):
            cols = conn.execute(text(f"PRAGMA table_info({table})")).fetchall()
            col_names = {row[1] for row in cols}
            if "user_id" not in col_names:
                conn.execute(text(f"ALTER TABLE {table} ADD COLUMN user_id INTEGER"))
        conn.commit()


def _purge_unscoped_clinical_data():
    """Remove legacy rows that are not tied to a specific authenticated user."""
    db = SessionLocal()
    try:
        db.query(ReferralDB).filter(ReferralDB.user_id.is_(None)).delete(synchronize_session=False)
        db.query(ScreeningDB).filter(ScreeningDB.user_id.is_(None)).delete(synchronize_session=False)
        db.query(PatientDB).filter(PatientDB.user_id.is_(None)).delete(synchronize_session=False)
        db.query(SyncQueueDB).filter(SyncQueueDB.user_id.is_(None)).delete(synchronize_session=False)
        db.query(UserDB).filter(UserDB.username == "nurse_sarita").delete(synchronize_session=False)
        db.commit()
    except Exception as e:
        db.rollback()
        print(f"[DB Migration Note] {e}")
    finally:
        db.close()


# ==========================================
# Pydantic Validation & Serialization Schemas
# ==========================================

# --- Auth Schemas ---
class UserRegister(BaseModel):
    username: str
    email: str
    password: str
    full_name: str
    role: str = "health_worker"
    clinic_location: str = "Primary Health Centre (PHC) Chittoor"

class UserLogin(BaseModel):
    username: str
    password: str

class UserResponse(BaseModel):
    id: int
    username: str
    email: str
    full_name: str
    role: str
    clinic_location: str
    is_active: bool
    created_at: datetime.datetime

    model_config = ConfigDict(from_attributes=True)

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in_minutes: int
    user: UserResponse


# --- Patient Schemas ---
class PatientCreate(BaseModel):
    patient_code: Optional[str] = None
    full_name: str
    age: int
    gender: str
    village: str
    diabetes_duration_years: float = 0.0
    phone: Optional[str] = None
    consent_given: bool = True

class PatientResponse(BaseModel):
    id: int
    patient_code: str
    full_name: str
    age: int
    gender: str
    village: str
    diabetes_duration_years: float
    phone: Optional[str]
    consent_given: bool
    created_at: datetime.datetime

    model_config = ConfigDict(from_attributes=True)


# --- Quality Check Schemas ---
class QualityCheckResponse(BaseModel):
    passed: bool
    issues: List[str]
    message: str
    recommendation: Optional[str] = ""
    laplacian_variance: float
    mean_brightness: float
    fov_fraction: float
    centered: bool


# --- Screening Schemas ---
class ScreeningResponse(BaseModel):
    id: int
    screening_code: str
    patient_id: int
    patient_code: str
    eye: str
    left_image_path: Optional[str] = None
    right_image_path: Optional[str] = None
    left_gradcam_path: Optional[str] = None
    right_gradcam_path: Optional[str] = None
    left_dr_grade: Optional[int] = None
    right_dr_grade: Optional[int] = None
    left_dr_grade_name: Optional[str] = None
    right_dr_grade_name: Optional[str] = None
    left_confidence: Optional[float] = None
    right_confidence: Optional[float] = None
    left_referable: Optional[bool] = None
    right_referable: Optional[bool] = None
    left_explanation: Optional[str] = None
    right_explanation: Optional[str] = None
    quality_passed: bool
    quality_issues: List[str]
    quality_message: str
    dr_grade: int
    dr_grade_name: str
    referable: bool
    confidence: float
    confidence_tier: str
    urgency_tier: str
    suggested_timeframe: str
    explanation_text: str
    lesion_summary: Dict[str, Any]
    status: str
    created_at: datetime.datetime

    model_config = ConfigDict(from_attributes=True)


# --- Referral Schemas ---
class ReferralCreate(BaseModel):
    patient_id: int
    screening_id: int
    urgency: Optional[str] = None
    target_facility: str = "District Eye Hospital, Tele-Ophthalmology Unit"
    notes: Optional[str] = ""

class ReferralResponse(BaseModel):
    id: int
    referral_code: str
    patient_id: int
    patient_code: str
    patient_name: str
    screening_id: int
    dr_grade: int
    dr_grade_name: str
    urgency: str
    target_facility: str
    referral_reason: str
    suggested_timeframe: str
    notes: Optional[str]
    status: str
    created_at: datetime.datetime
    left_image_path: Optional[str] = None
    right_image_path: Optional[str] = None
    left_gradcam_path: Optional[str] = None
    right_gradcam_path: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


# --- Dashboard Schemas ---
class DashboardSummary(BaseModel):
    today_screenings: int
    pending_referrals: int
    screened_this_week: int
    referable_rate_pct: float
    recent_patients: List[Dict[str, Any]]
    daily_trend_7d: List[Dict[str, Any]]
    model_metrics: Dict[str, Any]


# --- Capacity Simulation Schemas ---
class CapacitySimRequest(BaseModel):
    daily_arrivals: int = Field(default=350, ge=50, le=2000)
    capture_devices: int = Field(default=6, ge=1, le=30)
    network_bandwidth_tier: str = Field(default="4G_Rural", description="2G_Edge, 3G, 4G_Rural, Fiber")
    human_reviewers: int = Field(default=3, ge=1, le=20)
    review_time_per_case_sec: float = Field(default=25.0, ge=5.0, le=180.0)
    referral_rate_pct: float = Field(default=18.5, ge=5.0, le=50.0)
    operating_hours_per_day: float = Field(default=8.0, ge=4.0, le=16.0)

class CapacitySimResponse(BaseModel):
    annual_projected_capacity: int
    daily_throughput: float
    bottleneck_stage: str
    reviewer_utilization_pct: float
    capture_utilization_pct: float
    ai_compute_utilization_pct: float
    network_upload_utilization_pct: float
    time_to_clear_backlog_hours: float
    hourly_queue_trajectory: List[Dict[str, Any]]
    stage_latencies_sec: Dict[str, float]
    recommendations: List[str]
