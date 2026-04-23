from __future__ import annotations

from functools import lru_cache

from pymongo import ASCENDING, DESCENDING, MongoClient
from pymongo.collection import Collection
from pymongo.database import Database

from backend.core.config import get_settings


@lru_cache(maxsize=1)
def get_mongo_client() -> MongoClient:
    settings = get_settings()
    return MongoClient(settings.MONGO_URI, serverSelectionTimeoutMS=5000, tz_aware=True)


@lru_cache(maxsize=1)
def get_database() -> Database:
    settings = get_settings()
    client = get_mongo_client()
    client.admin.command("ping")
    db = client[settings.MONGO_DB_NAME]
    _ensure_indexes(db)
    return db


def _ensure_indexes(db: Database) -> None:
    db["users"].create_index([("email", ASCENDING)], unique=True)
    db["analyses"].create_index([("user_id", ASCENDING), ("created_at", DESCENDING)])
    db["profiles"].create_index([("user_id", ASCENDING)], unique=True)


def get_users_collection() -> Collection:
    return get_database()["users"]


def get_analyses_collection() -> Collection:
    return get_database()["analyses"]


def get_profiles_collection() -> Collection:
    return get_database()["profiles"]
