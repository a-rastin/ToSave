from datetime import date, timedelta

from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.deps import get_current_user
from app.models import PomodoroLog, User
from app.schemas import PomodoroLogIn, PomodoroStatsOut

router = APIRouter(prefix="/pomodoro", tags=["pomodoro"])


@router.post("/log", response_model=PomodoroStatsOut, status_code=201)
async def log_session(data: PomodoroLogIn, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    db.add(PomodoroLog(owner_id=user.id, day=date.today(), seconds=data.seconds, task_id=data.task_id))
    await db.commit()
    return await _stats(user.id, db)


@router.get("/stats", response_model=PomodoroStatsOut)
async def stats(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    return await _stats(user.id, db)


async def _stats(owner_id: int, db: AsyncSession) -> PomodoroStatsOut:
    since = date.today() - timedelta(days=13)
    rows = await db.execute(
        select(PomodoroLog.day, func.sum(PomodoroLog.seconds))
        .where(PomodoroLog.owner_id == owner_id, PomodoroLog.day >= since)
        .group_by(PomodoroLog.day)
    )
    by_day = {d.isoformat(): int(s) for d, s in rows.all()}
    return PomodoroStatsOut(today_seconds=by_day.get(date.today().isoformat(), 0), by_day=by_day)
