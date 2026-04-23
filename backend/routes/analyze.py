from __future__ import annotations

import logging
import time
from datetime import datetime, timezone
from typing import Any

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field

from backend.auth.auth import get_current_user
from backend.core.cdt import ModelArtifactError, run_cdt_pipeline
from backend.db.mongo import get_analyses_collection


logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api", tags=["analysis"])


class StudentInput(BaseModel):
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


def _persist_analysis(user_id: ObjectId, student_input: dict[str, Any], result: dict[str, Any]) -> None:
    doc = {
        "user_id": user_id,
        "input": student_input,
        "result": result,
        "created_at": datetime.now(timezone.utc),
    }
    get_analyses_collection().insert_one(doc)


@router.post("/analyze")
def analyze(student: StudentInput, current_user: dict[str, Any] = Depends(get_current_user)):
    payload = student.model_dump()
    user_id = current_user["_id"]
    logger.info("event=analysis.request user_id=%s", user_id)

    pipeline_start = time.perf_counter()
    try:
        result = run_cdt_pipeline(payload)
    except ValueError as exc:
        logger.exception("event=analysis.bad_input user_id=%s", user_id)
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    except ModelArtifactError as exc:
        logger.exception("event=analysis.pipeline_artifact_error user_id=%s", user_id)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Internal server error") from exc
    except Exception as exc:
        logger.exception("event=analysis.pipeline_error user_id=%s", user_id)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Internal server error") from exc

    duration_ms = (time.perf_counter() - pipeline_start) * 1000
    logger.info("event=analysis.pipeline_complete user_id=%s duration_ms=%.2f", user_id, duration_ms)

    try:
        _persist_analysis(user_id=user_id, student_input=payload, result=result)
    except Exception as exc:
        logger.exception("event=analysis.persist_error user_id=%s", user_id)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Internal server error") from exc

    return result
