from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.deps import get_current_user
from app.models import Label, Project, Task, User
from app.schemas import (
    LabelIn,
    LabelOut,
    ProjectIn,
    ProjectOut,
    ProjectUpdateIn,
    ReorderIn,
    TaskIn,
    TaskOut,
    TaskUpdateIn,
)
from app.tasks_util import encode_label_ids, next_due, task_out


async def _next_position(db: AsyncSession, model, owner_id: int) -> int:
    cur = await db.scalar(select(func.max(model.position)).where(model.owner_id == owner_id))
    return (cur or 0) + 1


async def _apply_order(db: AsyncSession, model, owner_id: int, ids: list[int]) -> None:
    rows = (await db.execute(select(model).where(model.owner_id == owner_id))).scalars().all()
    by_id = {r.id: r for r in rows}
    for pos, rid in enumerate(ids):
        if rid in by_id:
            by_id[rid].position = pos
    await db.commit()

router = APIRouter(tags=["items"])


# ---------------- Projects ----------------
@router.get("/projects", response_model=list[ProjectOut])
async def list_projects(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    rows = await db.execute(
        select(Project).where(Project.owner_id == user.id).order_by(Project.position, Project.id)
    )
    return rows.scalars().all()


@router.post("/projects", response_model=ProjectOut, status_code=201)
async def create_project(data: ProjectIn, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    p = Project(owner_id=user.id, position=await _next_position(db, Project, user.id), **data.model_dump())
    db.add(p)
    await db.commit()
    await db.refresh(p)
    return p


@router.patch("/projects/{pid}", response_model=ProjectOut)
async def update_project(
    pid: int, data: ProjectUpdateIn, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)
):
    p = await db.get(Project, pid)
    if not p or p.owner_id != user.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND)
    for k, v in data.model_dump(exclude_unset=True).items():
        setattr(p, k, v)
    await db.commit()
    await db.refresh(p)
    return p


@router.post("/projects/reorder", status_code=204)
async def reorder_projects(data: ReorderIn, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    await _apply_order(db, Project, user.id, data.ids)


@router.delete("/projects/{pid}", status_code=204)
async def delete_project(pid: int, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    p = await db.get(Project, pid)
    if not p or p.owner_id != user.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND)
    await db.delete(p)
    await db.commit()


# ---------------- Labels ----------------
@router.get("/labels", response_model=list[LabelOut])
async def list_labels(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    rows = await db.execute(select(Label).where(Label.owner_id == user.id).order_by(Label.id))
    return rows.scalars().all()


@router.post("/labels", response_model=LabelOut, status_code=201)
async def create_label(data: LabelIn, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    label = Label(owner_id=user.id, **data.model_dump())
    db.add(label)
    await db.commit()
    await db.refresh(label)
    return label


@router.delete("/labels/{lid}", status_code=204)
async def delete_label(lid: int, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    label = await db.get(Label, lid)
    if not label or label.owner_id != user.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND)
    await db.delete(label)
    await db.commit()


# ---------------- Tasks ----------------
async def _owned_task(tid: int, user: User, db: AsyncSession) -> Task:
    t = await db.get(Task, tid)
    if not t or t.owner_id != user.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND)
    return t


@router.get("/tasks", response_model=list[TaskOut])
async def list_tasks(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    project_id: int | None = Query(None),
    completed: bool | None = Query(None),
):
    q = select(Task).where(Task.owner_id == user.id)
    if project_id is not None:
        q = q.where(Task.project_id == project_id)
    if completed is not None:
        q = q.where(Task.completed == completed)
    rows = await db.execute(q.order_by(Task.completed, Task.position, Task.id))
    return [task_out(t) for t in rows.scalars().all()]


@router.post("/tasks", response_model=TaskOut, status_code=201)
async def create_task(data: TaskIn, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    payload = data.model_dump()
    payload["label_ids"] = encode_label_ids(payload.pop("label_ids"))
    t = Task(owner_id=user.id, position=await _next_position(db, Task, user.id), **payload)
    db.add(t)
    await db.commit()
    await db.refresh(t)
    return task_out(t)


@router.post("/tasks/reorder", status_code=204)
async def reorder_tasks(data: ReorderIn, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    await _apply_order(db, Task, user.id, data.ids)


@router.patch("/tasks/{tid}", response_model=TaskOut)
async def update_task(
    tid: int, data: TaskUpdateIn, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)
):
    t = await _owned_task(tid, user, db)
    fields = data.model_dump(exclude_unset=True)

    # Completing a recurring task: advance its due date and keep it open instead.
    if fields.get("completed") and t.rrule and t.due_date:
        nd = next_due(t.rrule, t.due_date)
        if nd:
            t.due_date = nd
            fields.pop("completed")  # stays active for the next occurrence

    if "label_ids" in fields:
        t.label_ids = encode_label_ids(fields.pop("label_ids"))
    if fields.get("completed"):
        t.completed_at = datetime.now(timezone.utc)
    elif fields.get("completed") is False:
        t.completed_at = None

    for k, v in fields.items():
        setattr(t, k, v)
    await db.commit()
    await db.refresh(t)
    return task_out(t)


@router.delete("/tasks/{tid}", status_code=204)
async def delete_task(tid: int, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    t = await _owned_task(tid, user, db)
    await db.delete(t)
    await db.commit()
