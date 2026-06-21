"""One end-to-end check: signup -> AI chat creates a task -> task is listed.
Run: pytest -q   (uses an in-memory sqlite, no external services)
"""
import asyncio
import os

os.environ["DATABASE_URL"] = "sqlite+aiosqlite:///./test_gord.db"

import httpx
import pytest
from httpx import ASGITransport

from app.api.ai import local_extract
from app.main import app
from datetime import date


def test_local_parser():
    out = local_extract("call the dentist tomorrow urgent; water plants every day", date(2026, 6, 21))
    assert len(out) == 2
    assert out[0]["due_date"] == date(2026, 6, 22)
    assert out[0]["priority"] == 3
    assert out[1]["rrule"] == "FREQ=DAILY"


@pytest.mark.asyncio
async def test_flow():
    transport = ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://t") as c:
        # FastAPI lifespan (init_db) doesn't run under ASGITransport, so create tables manually.
        from app.core.database import init_db
        await init_db()

        r = await c.post("/auth/signup", json={"email": "a@b.com", "password": "password123"})
        assert r.status_code == 201, r.text
        token = r.json()["access_token"]
        h = {"Authorization": f"Bearer {token}"}

        r = await c.post("/ai/chat", json={"message": "buy milk tomorrow, urgent"}, headers=h)
        assert r.status_code == 200, r.text
        assert len(r.json()["created_tasks"]) == 1

        r = await c.get("/tasks", headers=h)
        assert r.status_code == 200
        assert any("milk" in t["title"] for t in r.json())


if __name__ == "__main__":
    test_local_parser()
    asyncio.run(test_flow())
    print("all ok")
