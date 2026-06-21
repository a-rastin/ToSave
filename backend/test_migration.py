"""Regression test for the 'cannot add task/project' bug: upgrading over a
pre-v0.2 database left the new `position` column missing, so every create 500'd.
init_db now patches missing columns idempotently. Run: pytest -q
"""
import sqlite3

from sqlalchemy import create_engine, inspect

from app.core.database import _migrate


def test_migrate_adds_missing_columns(tmp_path):
    # a v0.1-style schema: projects/tasks without `position`
    db = tmp_path / "old.db"
    con = sqlite3.connect(db)
    con.executescript(
        "CREATE TABLE projects(id INTEGER PRIMARY KEY, owner_id INTEGER, name TEXT, color TEXT, created_at DATETIME);"
        "CREATE TABLE tasks(id INTEGER PRIMARY KEY, owner_id INTEGER, title TEXT, created_at DATETIME);"
    )
    con.close()

    eng = create_engine(f"sqlite:///{db}")
    with eng.begin() as conn:
        _migrate(conn)
        insp = inspect(conn)
        assert "position" in {c["name"] for c in insp.get_columns("projects")}
        assert "position" in {c["name"] for c in insp.get_columns("tasks")}

    with eng.begin() as conn:  # idempotent: running again must not raise
        _migrate(conn)
