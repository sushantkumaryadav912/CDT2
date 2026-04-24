from __future__ import annotations

from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, Field

from auth.auth import authenticate_user, create_access_token, create_user


router = APIRouter(prefix="/auth", tags=["auth"])


class SignupRequest(BaseModel):
    email: str = Field(min_length=3, max_length=254)
    password: str = Field(min_length=8, max_length=128)


class LoginRequest(BaseModel):
    email: str = Field(min_length=3, max_length=254)
    password: str = Field(min_length=8, max_length=128)


@router.post("/signup")
def signup(payload: SignupRequest):
    user = create_user(payload.email, payload.password)
    token = create_access_token(subject=user["id"], email=user["email"])
    return {"access_token": token, "token_type": "bearer", "user": user}


@router.post("/login")
def login(payload: LoginRequest):
    user = authenticate_user(payload.email, payload.password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    token = create_access_token(subject=user["id"], email=user["email"])
    return {"access_token": token, "token_type": "bearer", "user": user}
