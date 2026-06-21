from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import get_db
from app.core.security import (
    create_access_token,
    create_refresh_token,
    decode_token,
    hash_password,
    verify_password,
)
from app.deps import get_current_user
from app.models import User
from app.schemas import RefreshIn, SignupIn, TokenPair, UserOut, UserPrefs

router = APIRouter(prefix="/auth", tags=["auth"])


async def _by_email(db: AsyncSession, email: str) -> User | None:
    return (await db.execute(select(User).where(User.email == email))).scalar_one_or_none()


@router.post("/signup", response_model=TokenPair, status_code=201)
async def signup(data: SignupIn, db: AsyncSession = Depends(get_db)):
    if not settings.allow_signup:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Signup disabled")
    if await _by_email(db, data.email):
        raise HTTPException(status.HTTP_409_CONFLICT, "Email already registered")
    user = User(email=data.email, password_hash=hash_password(data.password))
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return TokenPair(access_token=create_access_token(user.id), refresh_token=create_refresh_token(user.id))


@router.post("/login", response_model=TokenPair)
async def login(form: OAuth2PasswordRequestForm = Depends(), db: AsyncSession = Depends(get_db)):
    # OAuth2 form uses "username"; we treat it as email.
    user = await _by_email(db, form.username)
    if not user or not verify_password(form.password, user.password_hash):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Bad credentials")
    return TokenPair(access_token=create_access_token(user.id), refresh_token=create_refresh_token(user.id))


@router.post("/refresh", response_model=TokenPair)
async def refresh(data: RefreshIn, db: AsyncSession = Depends(get_db)):
    user_id = decode_token(data.refresh_token, "refresh")
    if user_id is None or not await db.get(User, user_id):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid refresh token")
    return TokenPair(access_token=create_access_token(user_id), refresh_token=create_refresh_token(user_id))


@router.get("/me", response_model=UserOut)
async def me(user: User = Depends(get_current_user)):
    return user


@router.patch("/me", response_model=UserOut)
async def update_prefs(
    prefs: UserPrefs, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)
):
    if prefs.locale:
        user.locale = prefs.locale
    if prefs.calendar:
        user.calendar = prefs.calendar
    await db.commit()
    await db.refresh(user)
    return user
