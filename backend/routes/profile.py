from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field

from auth.auth import get_current_user
from db.mongo import get_profiles_collection


router = APIRouter(prefix="/api", tags=["profile"])


class UserProfileInput(BaseModel):
    name: str = "Student"
    cgpa: float = Field(ge=0, le=10)
    attendance: float = Field(ge=0, le=100)
    study_hours_per_week: float = Field(ge=0, le=80)
    assignment_score: float = Field(ge=0, le=100)
    exam_score: float = Field(ge=0, le=100)
    sleep_hours: float = Field(ge=3, le=12)
    extracurricular: int = Field(ge=0, le=2)
    mental_health_score: float = Field(ge=1, le=10)
    library_visits: int = Field(ge=0, le=30)
    online_course_hours: float = Field(ge=0, le=30)
    peer_study_sessions: int = Field(ge=0, le=14)
    semester: int = Field(ge=1, le=8)
    goal: str = "Data Scientist"
    resume_text: str = ""


def _serialize_profile(doc: dict[str, Any] | None) -> dict[str, Any] | None:
    if not doc:
        return None

    created_at = doc.get("created_at")
    updated_at = doc.get("updated_at")
    if isinstance(created_at, datetime):
        created_at = created_at.isoformat()
    if isinstance(updated_at, datetime):
        updated_at = updated_at.isoformat()

    return {
        "id": str(doc.get("_id")),
        "user_id": str(doc.get("user_id")),
        "profile": doc.get("profile", {}),
        "created_at": created_at,
        "updated_at": updated_at,
    }


@router.get("/profile")
def get_profile(current_user: dict[str, Any] = Depends(get_current_user)):
    doc = get_profiles_collection().find_one({"user_id": current_user["_id"]})
    return {"profile": _serialize_profile(doc)}


@router.put("/profile")
def upsert_profile(payload: UserProfileInput, current_user: dict[str, Any] = Depends(get_current_user)):
    now = datetime.now(timezone.utc)
    profile_data = payload.model_dump()

    get_profiles_collection().update_one(
        {"user_id": current_user["_id"]},
        {
            "$set": {
                "profile": profile_data,
                "updated_at": now,
            },
            "$setOnInsert": {
                "user_id": current_user["_id"],
                "created_at": now,
            },
        },
        upsert=True,
    )

    updated_doc = get_profiles_collection().find_one({"user_id": current_user["_id"]})
    return {"profile": _serialize_profile(updated_doc)}
