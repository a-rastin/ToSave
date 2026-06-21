import { useEffect, useMemo, useState } from "react";
import { api, clearTokens, isLoggedIn, type Project, type Task } from "./api";
import { dict, fmtDate, type Locale } from "./i18n";
import Login from "./components/Login";
import Chatbox from "./components/Chatbox";
import Pomodoro from "./components/Pomodoro";

const PRIO_COLOR = ["text-slate-400", "text-sky-400", "text-amber-400", "text-rose-400"];
type View = "list" | "calendar" | "timeline";
type Theme = "dark" | "light";

// Move dragId to dropId's slot. Pure + tested at bottom of file logic via tsc.
function reorder<T extends { id: number }>(list: T[], dragId: number, dropId: number): T[] {
  const from = list.findIndex((x) => x.id === dragId);
  const to = list.findIndex((x) => x.id === dropId);
  if (from < 0 || to < 0 || from === to) return list;
  const copy = [...list];
  const [moved] = copy.splice(from, 1);
  copy.splice(to, 0, moved);
  return copy;
}

export default function App() {
  const [authed, setAuthed] = useState(isLoggedIn());
  const [locale, setLocale] = useState<Locale>((localStorage.getItem("locale") as Locale) || "en");
  const [calendar, setCalendar] = useState<"gregorian" | "jalali">(
    (localStorage.getItem("calendar") as "gregorian" | "jalali") || "gregorian",
  );
  const [theme, setTheme] = useState<Theme>((localStorage.getItem("theme") as Theme) || "dark");
  const [view, setView] = useState<View>("list");
  const [tasks, setTasks] = useState<Task[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [active, setActive] = useState<number | null>(null); // project filter; null = inbox
  const [newTask, setNewTask] = useState("");
  const [editing, setEditing] = useState<{ kind: "task" | "project"; id: number; text: string } | null>(null);
  const [drag, setDrag] = useState<number | null>(null);
  const t = dict[locale];

  useEffect(() => {
    document.documentElement.dir = t.dir;
    document.documentElement.lang = locale;
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("locale", locale);
    localStorage.setItem("calendar", calendar);
    localStorage.setItem("theme", theme);
  }, [locale, calendar, theme, t.dir]);

  async function refresh() {
    const params: Record<string, string> = active != null ? { project_id: String(active) } : {};
    setTasks(await api.tasks(params));
    setProjects(await api.projects());
  }

  useEffect(() => {
    if (authed) {
      refresh();
      api.me().then((u) => {
        setLocale(u.locale);
        setCalendar(u.calendar);
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authed, active]);

  if (!authed) return <Login locale={locale} onAuthed={() => setAuthed(true)} />;

  async function addQuick(e: React.FormEvent) {
    e.preventDefault();
    if (!newTask.trim()) return;
    await api.addTask({ title: newTask, project_id: active ?? undefined });
    setNewTask("");
    refresh();
  }

  async function patchTask(id: number, data: Partial<Task>) {
    await api.updateTask(id, data);
    refresh();
  }

  async function setPrefs(l: Locale, c: "gregorian" | "jalali") {
    setLocale(l);
    setCalendar(c);
    api.savePrefs({ locale: l, calendar: c });
  }

  async function saveEdit() {
    if (!editing || !editing.text.trim()) return setEditing(null);
    if (editing.kind === "task") await api.updateTask(editing.id, { title: editing.text });
    else await api.updateProject(editing.id, { name: editing.text });
    setEditing(null);
    refresh();
  }

  // ---- drag and drop (native, no library) ----
  function dropTask(dropId: number) {
    if (drag == null) return;
    const next = reorder(tasks, drag, dropId);
    setTasks(next);
    api.reorderTasks(next.map((x) => x.id));
    setDrag(null);
  }
  function dropProject(dropId: number) {
    if (drag == null) return;
    const next = reorder(projects, drag, dropId);
    setProjects(next);
    api.reorderProjects(next.map((x) => x.id));
    setDrag(null);
  }

  function TaskRow({ task, draggable }: { task: Task; draggable: boolean }) {
    const isEditing = editing?.kind === "task" && editing.id === task.id;
    return (
      <div
        draggable={draggable}
        onDragStart={() => setDrag(task.id)}
        onDragOver={(e) => e.preventDefault()}
        onDrop={() => dropTask(task.id)}
        className={`group flex items-center gap-2 px-3 py-2.5 rounded-lg hover:bg-panel/60 ${drag === task.id ? "dragging" : ""}`}
      >
        {draggable && <span className="cursor-grab text-muted select-none">⠿</span>}
        <input
          type="checkbox"
          checked={task.completed}
          onChange={() => patchTask(task.id, { completed: !task.completed })}
          className="w-5 h-5 accent-indigo-500 shrink-0"
        />
        {isEditing ? (
          <input
            autoFocus
            value={editing!.text}
            onChange={(e) => setEditing({ ...editing!, text: e.target.value })}
            onBlur={saveEdit}
            onKeyDown={(e) => {
              if (e.key === "Enter") saveEdit();
              if (e.key === "Escape") setEditing(null);
            }}
            className="flex-1 bg-panel rounded px-2 py-1 outline-none focus:ring-2 ring-indigo-500"
          />
        ) : (
          <span
            onDoubleClick={() => setEditing({ kind: "task", id: task.id, text: task.title })}
            className={`flex-1 ${task.completed ? "line-through text-muted" : ""}`}
            title={t.edit}
          >
            {task.priority > 0 && <span className={PRIO_COLOR[task.priority]}>●</span>} {task.title}
            {task.rrule && <span className="text-muted text-xs ms-1">↻</span>}
          </span>
        )}
        <select
          value={task.priority}
          onChange={(e) => patchTask(task.id, { priority: Number(e.target.value) })}
          className="bg-transparent text-xs text-muted outline-none opacity-0 group-hover:opacity-100"
          title="Priority"
        >
          {t.priority.map((label, i) => (
            <option key={i} value={i} className="bg-panel text-fg">
              {label}
            </option>
          ))}
        </select>
        <input
          type="date"
          value={task.due_date ? task.due_date.slice(0, 10) : ""}
          onChange={(e) => patchTask(task.id, { due_date: e.target.value || null })}
          className="bg-transparent text-xs text-muted outline-none w-[7.5rem] opacity-0 group-hover:opacity-100"
          title={t.calendar}
        />
        <button
          onClick={async () => {
            await api.deleteTask(task.id);
            refresh();
          }}
          className="opacity-0 group-hover:opacity-100 text-muted hover:text-rose-400 text-sm"
          title={t.delete}
        >
          ✕
        </button>
      </div>
    );
  }

  const byDay = useMemo(() => {
    const map = new Map<string, Task[]>();
    for (const task of tasks) {
      const key = task.due_date ? task.due_date.slice(0, 10) : "";
      (map.get(key) ?? map.set(key, []).get(key)!).push(task);
    }
    return [...map.entries()].sort((a, b) => (a[0] === "" ? 1 : b[0] === "" ? -1 : a[0].localeCompare(b[0])));
  }, [tasks]);

  return (
    <div className="min-h-screen flex flex-col md:flex-row">
      {/* Sidebar */}
      <aside className="md:w-64 border-b md:border-b-0 md:border-e border-line p-4 flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold">{t.appName}</h1>
          <button
            onClick={() => {
              clearTokens();
              setAuthed(false);
            }}
            className="text-xs text-muted hover:text-fg"
          >
            {t.logout}
          </button>
        </div>

        <nav className="mt-2 space-y-1">
          <button
            onClick={() => setActive(null)}
            className={`block w-full text-start px-3 py-2 rounded-lg ${active === null ? "bg-panel" : "hover:bg-panel/60"}`}
          >
            {t.inbox}
          </button>
          {projects.map((p) => (
            <div
              key={p.id}
              draggable
              onDragStart={() => setDrag(p.id)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => dropProject(p.id)}
              className={`group flex items-center gap-2 px-3 py-2 rounded-lg ${active === p.id ? "bg-panel" : "hover:bg-panel/60"} ${drag === p.id ? "dragging" : ""}`}
            >
              <span className="w-2 h-2 rounded-full shrink-0" style={{ background: p.color }} />
              {editing?.kind === "project" && editing.id === p.id ? (
                <input
                  autoFocus
                  value={editing.text}
                  onChange={(e) => setEditing({ ...editing, text: e.target.value })}
                  onBlur={saveEdit}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") saveEdit();
                    if (e.key === "Escape") setEditing(null);
                  }}
                  className="flex-1 bg-app rounded px-2 py-0.5 outline-none focus:ring-2 ring-indigo-500"
                />
              ) : (
                <button
                  onClick={() => setActive(p.id)}
                  onDoubleClick={() => setEditing({ kind: "project", id: p.id, text: p.name })}
                  className="flex-1 text-start"
                  title={t.edit}
                >
                  {p.name}
                </button>
              )}
            </div>
          ))}
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              const el = (e.target as HTMLFormElement).elements.namedItem("p") as HTMLInputElement;
              if (el.value.trim()) {
                await api.addProject(el.value.trim());
                el.value = "";
                refresh();
              }
            }}
          >
            <input
              name="p"
              placeholder={t.newProject}
              className="w-full bg-transparent text-sm px-3 py-2 text-muted outline-none"
            />
          </form>
        </nav>

        <div className="mt-auto border-t border-line pt-2">
          <Pomodoro locale={locale} />
          <div className="flex gap-1 text-xs justify-center mt-2 flex-wrap">
            <button onClick={() => setPrefs("en", calendar)} className={locale === "en" ? "text-indigo-400" : "text-muted"}>EN</button>
            <span className="text-muted/40">|</span>
            <button onClick={() => setPrefs("fa", calendar)} className={locale === "fa" ? "text-indigo-400" : "text-muted"}>فا</button>
            <span className="text-muted/40 mx-1">·</span>
            <button onClick={() => setPrefs(locale, "gregorian")} className={calendar === "gregorian" ? "text-indigo-400" : "text-muted"}>Greg</button>
            <span className="text-muted/40">|</span>
            <button onClick={() => setPrefs(locale, "jalali")} className={calendar === "jalali" ? "text-indigo-400" : "text-muted"}>Jalali</button>
            <span className="text-muted/40 mx-1">·</span>
            <button onClick={() => setTheme(theme === "dark" ? "light" : "dark")} className="text-muted hover:text-fg">
              {theme === "dark" ? `☀ ${t.light}` : `🌙 ${t.dark}`}
            </button>
          </div>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 flex flex-col max-w-3xl mx-auto w-full">
        <div className="flex gap-1 p-3 border-b border-line text-sm">
          {(["list", "calendar", "timeline"] as View[]).map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={`px-3 py-1.5 rounded-lg ${view === v ? "bg-panel" : "text-muted hover:text-fg"}`}
            >
              {t[v]}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {view === "list" && (
            <>
              <form onSubmit={addQuick} className="mb-4">
                <input
                  value={newTask}
                  onChange={(e) => setNewTask(e.target.value)}
                  placeholder={t.addTask}
                  className="w-full rounded-lg bg-panel px-4 py-3 outline-none focus:ring-2 ring-indigo-500"
                />
              </form>
              {tasks.length === 0 && <p className="text-center text-muted mt-16">{t.noTasks}</p>}
              {tasks.map((task) => (
                <TaskRow key={task.id} task={task} draggable />
              ))}
            </>
          )}

          {view === "calendar" &&
            byDay.map(([day, list]) => (
              <div key={day || "none"} className="mb-3">
                <p className="text-xs uppercase tracking-wide text-muted px-3 mb-1">
                  {day ? fmtDate(day, locale, calendar) : t.noSchedule}
                </p>
                {list.map((task) => (
                  <TaskRow key={task.id} task={task} draggable={false} />
                ))}
              </div>
            ))}

          {view === "timeline" &&
            (active == null ? (
              <p className="text-center text-muted mt-16">{t.selectProject}</p>
            ) : (
              [...tasks]
                .sort((a, b) => a.created_at.localeCompare(b.created_at))
                .map((task) => (
                  <div key={task.id} className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-panel/60">
                    <span className={task.completed ? "line-through text-muted" : ""}>{task.title}</span>
                    <span className="ms-auto text-xs text-muted">
                      {t.added}: {fmtDate(task.created_at, locale, calendar)}
                    </span>
                    <span className="text-xs text-muted">
                      {t.finished}:{" "}
                      {task.completed_at ? fmtDate(task.completed_at, locale, calendar) : t.open}
                    </span>
                  </div>
                ))
            ))}
        </div>

        <Chatbox locale={locale} onTasks={() => refresh()} />
      </main>
    </div>
  );
}
