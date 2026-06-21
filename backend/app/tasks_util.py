from datetime import date

from dateutil.rrule import rrulestr

from app.models import Task
from app.schemas import TaskOut


def task_out(t: Task) -> TaskOut:
    ids = [int(x) for x in t.label_ids.split(",")] if t.label_ids else []
    return TaskOut(
        id=t.id,
        title=t.title,
        notes=t.notes,
        priority=t.priority,
        position=t.position,
        due_date=t.due_date,
        rrule=t.rrule,
        project_id=t.project_id,
        parent_id=t.parent_id,
        completed=t.completed,
        created_at=t.created_at,
        completed_at=t.completed_at,
        label_ids=ids,
    )


def encode_label_ids(ids: list[int] | None) -> str | None:
    return ",".join(str(i) for i in ids) if ids else None


def next_due(rrule: str, after: date) -> date | None:
    """Next occurrence strictly after `after` for an RRULE like 'FREQ=DAILY;INTERVAL=2'."""
    try:
        rule = rrulestr(rrule, dtstart=__import__("datetime").datetime.combine(after, __import__("datetime").time()))
        nxt = rule.after(__import__("datetime").datetime.combine(after, __import__("datetime").time()))
        return nxt.date() if nxt else None
    except (ValueError, TypeError):
        return None


if __name__ == "__main__":
    # ponytail: one runnable check for the recurrence math.
    assert next_due("FREQ=DAILY", date(2026, 6, 21)) == date(2026, 6, 22)
    assert next_due("FREQ=WEEKLY", date(2026, 6, 21)) == date(2026, 6, 28)
    assert next_due("FREQ=DAILY;INTERVAL=3", date(2026, 6, 21)) == date(2026, 6, 24)
    assert next_due("garbage", date(2026, 6, 21)) is None
    print("recurrence ok")
