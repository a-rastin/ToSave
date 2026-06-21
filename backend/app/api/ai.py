"""AI chatbox: turns natural language into tasks.

Default path is a local regex/date parser so the app works with no API key.
If GEMINI_API_KEY is set, we ask Gemini to extract structured tasks instead.
"""
import json
import re
from datetime import date, timedelta

import httpx
from dateutil import parser as dateparser
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import get_db
from app.deps import get_current_user
from app.models import Task, User
from app.schemas import AIChatIn, AIChatOut
from app.tasks_util import encode_label_ids, task_out

router = APIRouter(prefix="/ai", tags=["ai"])

WEEKDAYS = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]
PRIORITY_WORDS = {"urgent": 3, "asap": 3, "important": 2, "high": 2, "low": 1}
FREQ = {"daily": "FREQ=DAILY", "weekly": "FREQ=WEEKLY", "monthly": "FREQ=MONTHLY", "yearly": "FREQ=YEARLY"}


def _parse_due(text: str, today: date) -> date | None:
    t = text.lower()
    if "today" in t:
        return today
    if "tomorrow" in t:
        return today + timedelta(days=1)
    for i, wd in enumerate(WEEKDAYS):
        if wd in t:
            ahead = (i - today.weekday()) % 7 or 7
            return today + timedelta(days=ahead)
    m = re.search(r"\bon ([A-Za-z0-9 ,/\-]+)", t)
    if m:
        try:
            return dateparser.parse(m.group(1), fuzzy=True, default=__import__("datetime").datetime.combine(today, __import__("datetime").time())).date()
        except (ValueError, OverflowError):
            return None
    return None


def _parse_rrule(text: str) -> str | None:
    t = text.lower()
    for word, rule in FREQ.items():
        if word in t:
            return rule
    m = re.search(r"every (\w+)", t)
    if m:
        w = m.group(1)
        if w in WEEKDAYS:
            return f"FREQ=WEEKLY;BYDAY={w[:2].upper()}"
        if w in ("day", "week", "month", "year"):
            return f"FREQ={ {'day':'DAILY','week':'WEEKLY','month':'MONTHLY','year':'YEARLY'}[w] }"
    return None


def _clean_title(line: str) -> str:
    title = re.sub(r"^(add|create|remind me to|i need to|todo:?|task:?)\s+", "", line.strip(), flags=re.I)
    title = re.sub(r"\b(today|tomorrow|urgent|asap|important|daily|weekly|monthly|yearly)\b", "", title, flags=re.I)
    title = re.sub(r"\bevery \w+\b", "", title, flags=re.I)
    title = re.sub(r"\bon [A-Za-z0-9 ,/\-]+$", "", title, flags=re.I)
    return re.sub(r"\s{2,}", " ", title).strip(" .,") or line.strip()


def local_extract(message: str, today: date) -> list[dict]:
    tasks = []
    for line in re.split(r"[\n;]|(?:,?\s+and\s+)", message):
        line = line.strip()
        if not line:
            continue
        prio = next((p for w, p in PRIORITY_WORDS.items() if w in line.lower()), 0)
        tasks.append({
            "title": _clean_title(line),
            "priority": prio,
            "due_date": _parse_due(line, today),
            "rrule": _parse_rrule(line),
        })
    return tasks


async def gemini_extract(message: str, today: date) -> list[dict]:
    prompt = (
        "Extract a JSON array of to-do tasks from the user's message. "
        'Each item: {"title": str, "priority": 0-3, "due_date": "YYYY-MM-DD" or null, '
        '"rrule": iCal RRULE string or null}. '
        f"Today is {today.isoformat()}. Return ONLY the JSON array.\n\nMessage: {message}"
    )
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{settings.gemini_model}:generateContent"
    async with httpx.AsyncClient(timeout=20) as client:
        r = await client.post(
            url,
            params={"key": settings.gemini_api_key},
            json={"contents": [{"parts": [{"text": prompt}]}]},
        )
        r.raise_for_status()
        raw = r.json()["candidates"][0]["content"]["parts"][0]["text"]
    raw = re.sub(r"^```(?:json)?|```$", "", raw.strip(), flags=re.M).strip()
    items = json.loads(raw)
    for it in items:
        if it.get("due_date"):
            it["due_date"] = date.fromisoformat(it["due_date"])
    return items


@router.post("/chat", response_model=AIChatOut)
async def chat(data: AIChatIn, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    today = date.today()
    try:
        extracted = await gemini_extract(data.message, today) if settings.gemini_api_key else local_extract(data.message, today)
    except Exception:  # ponytail: any AI/network failure falls back to the local parser
        extracted = local_extract(data.message, today)

    created = []
    for item in extracted:
        if not item.get("title"):
            continue
        t = Task(
            owner_id=user.id,
            title=item["title"],
            priority=int(item.get("priority") or 0),
            due_date=item.get("due_date"),
            rrule=item.get("rrule"),
            label_ids=encode_label_ids(None),
        )
        db.add(t)
        created.append(t)
    await db.commit()
    for t in created:
        await db.refresh(t)

    if created:
        reply = "Added: " + ", ".join(f"“{t.title}”" for t in created)
    else:
        reply = "I couldn't find a task in that. Try: “call the dentist tomorrow, urgent”."
    return AIChatOut(reply=reply, created_tasks=[task_out(t) for t in created])
