import uuid
import datetime
from typing import List
from fastapi import APIRouter, Depends, HTTPException, Body
from sqlalchemy.orm import Session
from sqlalchemy import desc

from backend.app.models.schemas import (
    ReferralDB, ScreeningDB, ReferralCreate, ReferralResponse, UserDB, get_db
)
from backend.app.routers.auth import require_auth
from backend.app.utils.tenant import get_user_patient, get_user_screening, get_user_referral

router = APIRouter(prefix="/referrals", tags=["Referrals"])


def _format_referral_response(referral: ReferralDB, db: Session) -> ReferralResponse:
    """Build ReferralResponse, enriched with Grad-CAM image paths from the linked screening."""
    screening = db.query(ScreeningDB).filter(ScreeningDB.id == referral.screening_id).first()
    return ReferralResponse(
        id=referral.id,
        referral_code=referral.referral_code,
        patient_id=referral.patient_id,
        patient_code=referral.patient_code,
        patient_name=referral.patient_name,
        screening_id=referral.screening_id,
        dr_grade=referral.dr_grade,
        dr_grade_name=referral.dr_grade_name,
        urgency=referral.urgency,
        target_facility=referral.target_facility,
        referral_reason=referral.referral_reason,
        suggested_timeframe=referral.suggested_timeframe,
        notes=referral.notes,
        status=referral.status,
        created_at=referral.created_at,
        left_image_path=screening.left_image_path if screening else None,
        right_image_path=screening.right_image_path if screening else None,
        left_gradcam_path=screening.left_gradcam_path if screening else None,
        right_gradcam_path=screening.right_gradcam_path if screening else None,
    )


@router.post("", response_model=ReferralResponse)
def create_referral(
    req: ReferralCreate,
    current_user: UserDB = Depends(require_auth),
    db: Session = Depends(get_db)
):
    patient = get_user_patient(db, req.patient_id, current_user.id)
    screening = get_user_screening(db, req.screening_id, current_user.id)

    if screening.patient_id != patient.id:
        raise HTTPException(status_code=400, detail="Screening does not belong to this patient")

    existing_referral = (
        db.query(ReferralDB)
        .filter(
            ReferralDB.user_id == current_user.id,
            ReferralDB.screening_id == req.screening_id,
        )
        .first()
    )
    if existing_referral:
        return _format_referral_response(existing_referral, db)

    referral_code = f"REF-{datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%d')}-{uuid.uuid4().hex[:6].upper()}"

    urgency = req.urgency or screening.urgency_tier or "Priority"
    suggested_timeframe = screening.suggested_timeframe or "Within 30 days"
    referral_reason = (
        f"AI screening indicated {screening.dr_grade_name} with {screening.confidence}% confidence. "
        f"Recommended for comprehensive dilated slit-lamp fundus examination, optical coherence tomography (OCT), "
        f"and tele-ophthalmology triage confirmation."
    )

    new_referral = ReferralDB(
        user_id=current_user.id,
        referral_code=referral_code,
        patient_id=patient.id,
        patient_code=patient.patient_code,
        patient_name=patient.full_name,
        screening_id=screening.id,
        dr_grade=screening.dr_grade,
        dr_grade_name=screening.dr_grade_name,
        urgency=urgency,
        target_facility=req.target_facility,
        referral_reason=referral_reason,
        suggested_timeframe=suggested_timeframe,
        notes=req.notes or "",
        status="Pending",
        created_at=datetime.datetime.now(datetime.timezone.utc)
    )

    screening.status = "Referred"

    db.add(new_referral)
    db.commit()
    db.refresh(new_referral)

    return _format_referral_response(new_referral, db)


@router.get("", response_model=List[ReferralResponse])
def list_referrals(
    limit: int = 50,
    current_user: UserDB = Depends(require_auth),
    db: Session = Depends(get_db)
):
    referrals = (
        db.query(ReferralDB)
        .filter(ReferralDB.user_id == current_user.id)
        .order_by(desc(ReferralDB.created_at))
        .limit(limit)
        .all()
    )
    return [_format_referral_response(r, db) for r in referrals]


@router.get("/{referral_id}", response_model=ReferralResponse)
def get_referral(
    referral_id: int,
    current_user: UserDB = Depends(require_auth),
    db: Session = Depends(get_db)
):
    referral = get_user_referral(db, referral_id, current_user.id)
    return _format_referral_response(referral, db)


@router.patch("/{referral_id}/status", response_model=ReferralResponse)
def update_referral_status(
    referral_id: int,
    status: str = Body(..., embed=True),
    current_user: UserDB = Depends(require_auth),
    db: Session = Depends(get_db)
):
    referral = get_user_referral(db, referral_id, current_user.id)
    referral.status = status
    db.commit()
    db.refresh(referral)
    return _format_referral_response(referral, db)
