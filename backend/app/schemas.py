from datetime import date, datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field


# ---- Auth ----
class SignupIn(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8)


class LoginIn(BaseModel):
    email: EmailStr
    password: str


class TokenPair(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class RefreshIn(BaseModel):
    refresh_token: str


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    email: EmailStr
    locale: str
    calendar: str


class UserPrefs(BaseModel):
    locale: str | None = None
    calendar: str | None = None


# ---- Project / Label ----
class ProjectIn(BaseModel):
    name: str
    color: str = "#6366f1"


class ProjectOut(ProjectIn):
    model_config = ConfigDict(from_attributes=True)
    id: int


class LabelIn(BaseModel):
    name: str
    color: str = "#94a3b8"


class LabelOut(LabelIn):
    model_config = ConfigDict(from_attributes=True)
    id: int


# ---- Task ----
class TaskIn(BaseModel):
    title: str
    notes: str | None = None
    priority: int = Field(default=0, ge=0, le=3)
    due_date: date | None = None
    rrule: str | None = None
    project_id: int | None = None
    parent_id: int | None = None
    label_ids: list[int] = []


class TaskUpdateIn(BaseModel):
    title: str | None = None
    notes: str | None = None
    priority: int | None = Field(default=None, ge=0, le=3)
    due_date: date | None = None
    rrule: str | None = None
    project_id: int | None = None
    completed: bool | None = None
    label_ids: list[int] | None = None


class TaskOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    title: str
    notes: str | None
    priority: int
    due_date: date | None
    rrule: str | None
    project_id: int | None
    parent_id: int | None
    completed: bool
    completed_at: datetime | None
    label_ids: list[int]


# ---- AI ----
class AIChatIn(BaseModel):
    message: str


class AIChatOut(BaseModel):
    reply: str
    created_tasks: list[TaskOut] = []
