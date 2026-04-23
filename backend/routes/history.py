from __future__ import annotations

from datetime import datetime
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pymongo import DESCENDING

from backend.auth.auth import get_current_user
from backend.db.mongo import get_analyses_collection


router = APIRouter(prefix="/api", tags=["history"])


def _serialize_analysis(doc: dict[str, Any]) -> dict[str, Any]:
    created_at = doc.get("created_at")
    if isinstance(created_at, datetime):
        created_at = created_at.isoformat()
    return {
        "id": str(doc["_id"]),
        "user_id": str(doc["user_id"]),
        "input": doc["input"],
        "result": doc["result"],
        "created_at": created_at,
    }


@router.get("/history")
def get_history(
    limit: int = Query(default=20, ge=1, le=100),
    current_user: dict[str, Any] = Depends(get_current_user),
):
    cursor = (
        get_analyses_collection()
        .find({"user_id": current_user["_id"]})
        .sort("created_at", DESCENDING)
        .limit(limit)
    )
    history = [_serialize_analysis(doc) for doc in cursor]
    return {"history": history}
