# Gord

An AI-assisted to-do, calendar & focus app. Tell it what to do in plain language
(text or voice) and it turns your words into tasks. Bilingual (English / Persian,
LTR / RTL), dual-calendar (Gregorian / Jalali), installable as a PWA, with a
built-in Pomodoro timer and RRULE-based recurring tasks. ADHD-friendly,
zero-distraction UI.

This is the **Core MVP**: tasks, projects, labels, priorities, due dates,
recurring to-dos, the AI chatbox, auth, Pomodoro, bilingual + dual-calendar, PWA.
Habits, Google Drive attachments, and Telegram/web-push reminders are scoped for a
later pass.

## Stack

| Layer    | Tech |
|----------|------|
| Backend  | Python · FastAPI · async SQLAlchemy 2.0 |
| Frontend | React · Vite · TypeScript · Tailwind v4 (PWA) |
| Database | PostgreSQL (SQLite by default for zero-config local dev) |
| AI       | Google Gemini (`gemini-2.0-flash`), with a built-in offline parser fallback |

## Run it

### Option A — Docker (Postgres + Redis + both apps)

```bash
cp .env.example .env          # adjust if you like; defaults work
docker compose up --build
```

- App: http://localhost:5173
- API docs: http://localhost:8000/docs

### Option B — Local dev, no Docker

Backend (defaults to a local SQLite file, no Postgres needed):

```bash
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload
```

Frontend:

```bash
cd frontend
npm install
npm run dev
```

## The AI chatbox

Type or speak something like *“call the dentist tomorrow, urgent; water plants
every day”* and it creates the tasks, parsing due dates, priorities, and
recurrence. With no `GEMINI_API_KEY` set it uses a local rule-based parser, so the
feature works out of the box. Add a key in `.env` to use Gemini instead — and if
Gemini is unreachable, it automatically falls back to the local parser.

Voice uses the browser's built-in Web Speech API (no extra service).

## Notes & deliberate simplifications

- **Migrations:** the schema is created with SQLAlchemy `create_all` on startup.
  Add Alembic (`alembic init`) when the schema needs to evolve against real data.
- **Labels** are stored as a compact id list on each task rather than a join
  table — fine for an MVP; switch to an association table when you need to
  filter/aggregate by label at scale.
- **Caddy** (HTTPS reverse proxy) is part of the production target but omitted
  from local compose; add it when deploying.
- **Auth:** JWT access + refresh tokens, Argon2 password hashing, public signup
  (toggle with `ALLOW_SIGNUP`).

## Tests

```bash
cd backend
DATABASE_URL="sqlite+aiosqlite:///./test.db" pytest -q
```

Covers the local task parser and the signup → AI-chat → list-tasks flow.
```

