from collections.abc import AsyncGenerator

from sqlalchemy import inspect
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase

from app.core.config import settings

engine = create_async_engine(settings.database_url, echo=False, future=True)
SessionLocal = async_sessionmaker(engine, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    async with SessionLocal() as session:
        yield session


# Columns added to EXISTING tables after v0.1. create_all makes new tables but
# never alters old ones, so we add these idempotently on startup.
# ponytail: a 3-line column patcher beats Alembic here; add a row when you add a
# column to an existing table. Move to Alembic when changes get non-trivial.
_ADDED_COLUMNS = [
    ("tasks", "position", "INTEGER NOT NULL DEFAULT 0"),
    ("projects", "position", "INTEGER NOT NULL DEFAULT 0"),
]


def _migrate(conn) -> None:
    insp = inspect(conn)
    existing = set(insp.get_table_names())
    for table, col, decl in _ADDED_COLUMNS:
        if table in existing and col not in {c["name"] for c in insp.get_columns(table)}:
            conn.exec_driver_sql(f"ALTER TABLE {table} ADD COLUMN {col} {decl}")


async def init_db() -> None:
    from app import models  # noqa: F401  (register models)

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)  # new tables (e.g. pomodoro_logs)
        await conn.run_sync(_migrate)                   # new columns on existing tables
