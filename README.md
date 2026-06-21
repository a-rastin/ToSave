# Special Swan

An AI-assisted to-do, calendar & focus app. Tell it what to do in plain language
(text or voice) and it turns your words into tasks. Bilingual (English / Persian,
LTR / RTL), dual-calendar (Gregorian / Jalali), light & dark themes, installable as
a PWA, with a built-in Pomodoro timer + daily focus tracking and RRULE-based
recurring tasks. ADHD-friendly, zero-distraction UI.

## Features

- **Tasks & projects** — create, rename (double-click), prioritize (None / Low /
  Medium / High), schedule to a day, reorder by **drag and drop**, recurring
  to-dos (RRULE).
- **AI chatbox** — type or speak; Gemini (`gemini-flash-latest`) extracts tasks
  with dates/priority/recurrence. Falls back to a local parser with no key.
- **Views** — List, Calendar (tasks grouped by day), and per-project Timeline
  showing each task's *Date Added* and *Date Finished*.
- **Pomodoro** — work/break timer that records daily focus time.
- **Themes** — light / dark, switchable; bilingual + dual-calendar per user.
- **Auth** — JWT access + refresh, Argon2 hashing, public signup.

## Stack

| Layer    | Tech |
|----------|------|
| Backend  | Python · FastAPI · async SQLAlchemy 2.0 |
| Frontend | React · Vite · TypeScript · Tailwind v4 (PWA) |
| Database | PostgreSQL (SQLite by default for zero-config local dev) |
| AI       | Google Gemini (`gemini-flash-latest`), with an offline parser fallback |

## Run it

### Docker

```bash
cp .env.example .env          # defaults work; add your Gemini key if you have one
docker compose up --build
```

- App: http://localhost:5173 · API docs: http://localhost:8000/docs

### Local dev (no Docker)

```bash
cd backend && pip install -r requirements.txt && uvicorn app.main:app --reload
cd frontend && npm install && npm run dev
```

## Gemini key — handle with care

Set `GEMINI_API_KEY` in `.env` (gitignored). Never commit it or paste it into
chat/code. If a key has ever been shared in plaintext, rotate it in Google AI
Studio. With no key, the app still works via the local parser.

## Notes & deliberate simplifications

- **Schema changes:** tables are created with `create_all` on startup, so the new
  `position` / pomodoro columns only appear on a **fresh** database. For an
  existing dev DB, delete `backend/gord.db` (or your Postgres volume) and restart.
  Add Alembic when you need migrations against real data.
- **Drag reorder** uses native HTML5 drag-and-drop (no library) and persists order
  via a `position` column. Reordering inside a filtered (per-project) list reorders
  only the visible tasks.
- **Calendar / scheduling** uses the native `<input type="date">` and `Intl`
  dual-calendar formatting — no date-picker library.
- **Labels** are stored inline per task; switch to a join table to filter at scale.
- **Caddy** (HTTPS) is for the production target; omitted from local compose.

## Tests

```bash
cd backend
DATABASE_URL="sqlite+aiosqlite:///./test.db" pytest -q
```

`test_app.py` covers the parser and signup → AI-chat → list flow; `test_features.py`
covers rename, drag-reorder, priority/due-date, timeline fields, and pomodoro
tracking.
