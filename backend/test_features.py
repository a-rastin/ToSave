"""Feature tests for v0.2: project rename, drag-reorder, priority/due-date,
timeline fields, pomodoro tracking. Run: pytest -q  (in-memory sqlite, no services)
"""
import os

os.environ.setdefault("DATABASE_URL", "sqlite+aiosqlite:///./test_features.db")

import asyncio

import httpx
import pytest
from httpx import ASGITransport

from app.main import app


@pytest.mark.asyncio
async def test_features():
    if os.path.exists("./test_features.db"):
        os.remove("./test_features.db")
    from app.core.database import init_db

    await init_db()
    async with httpx.AsyncClient(transport=ASGITransport(app=app), base_url="http://t") as c:
        r = await c.post("/auth/signup", json={"email": "f@b.com", "password": "password123"})
        assert r.status_code == 201
        h = {"Authorization": f"Bearer {r.json()['access_token']}"}

        # project create + rename
        p = (await c.post("/projects", json={"name": "Proj"}, headers=h)).json()
        renamed = (await c.patch(f"/projects/{p['id']}", json={"name": "Renamed"}, headers=h)).json()
        assert renamed["name"] == "Renamed"

        # two tasks then drag-reorder (persisted via position)
        t1 = (await c.post("/tasks", json={"title": "one"}, headers=h)).json()
        t2 = (await c.post("/tasks", json={"title": "two"}, headers=h)).json()
        assert [t["id"] for t in (await c.get("/tasks", headers=h)).json()] == [t1["id"], t2["id"]]
        await c.post("/tasks/reorder", json={"ids": [t2["id"], t1["id"]]}, headers=h)
        assert [t["id"] for t in (await c.get("/tasks", headers=h)).json()] == [t2["id"], t1["id"]]

        # priority + due date + timeline fields
        upd = (await c.patch(f"/tasks/{t1['id']}", json={"priority": 3, "due_date": "2026-06-25"}, headers=h)).json()
        assert upd["priority"] == 3 and upd["due_date"] == "2026-06-25" and "created_at" in upd

        # pomodoro daily tracking
        s = (await c.post("/pomodoro/log", json={"seconds": 1500}, headers=h)).json()
        assert s["today_seconds"] == 1500
        assert (await c.get("/pomodoro/stats", headers=h)).json()["today_seconds"] == 1500


if __name__ == "__main__":
    asyncio.run(test_features())
    print("features ok")
