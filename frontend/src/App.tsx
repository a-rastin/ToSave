import { useEffect, useState } from "react";
import { api, clearTokens, isLoggedIn, type Project, type Task } from "./api";
import { dict, fmtDate, type Locale } from "./i18n";
import Login from "./components/Login";
import Chatbox from "./components/Chatbox";
import Pomodoro from "./components/Pomodoro";

const PRIO_COLOR = ["text-slate-500", "text-sky-400", "text-amber-400", "text-rose-400"];

export default function App() {
  const [authed, setAuthed] = useState(isLoggedIn());
  const [locale, setLocale] = useState<Locale>((localStorage.getItem("locale") as Locale) || "en");
  const [calendar, setCalendar] = useState<"gregorian" | "jalali">(
    (localStorage.getItem("calendar") as "gregorian" | "jalali") || "gregorian",
  );
  const [tasks, setTasks] = useState<Task[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [active, setActive] = useState<number | null>(null); // project filter; null = inbox
  const [newTask, setNewTask] = useState("");
  const t = dict[locale];

  useEffect(() => {
    document.documentElement.dir = t.dir;
    document.documentElement.lang = locale;
    localStorage.setItem("locale", locale);
    localStorage.setItem("calendar", calendar);
  }, [locale, calendar, t.dir]);

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

  async function toggle(task: Task) {
    await api.updateTask(task.id, { completed: !task.completed });
    refresh();
  }

  async function setPrefs(l: Locale, c: "gregorian" | "jalali") {
    setLocale(l);
    setCalendar(c);
    api.savePrefs({ locale: l, calendar: c });
  }

  return (
    <div className="min-h-screen flex flex-col md:flex-row">
      {/* Sidebar */}
      <aside className="md:w-64 border-b md:border-b-0 md:border-e border-slate-800 p-4 flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold">{t.appName}</h1>
          <button
            onClick={() => {
              clearTokens();
              setAuthed(false);
            }}
            className="text-xs text-slate-400 hover:text-slate-200"
          >
            {t.logout}
          </button>
        </div>

        <nav className="mt-2 space-y-1">
          <button
            onClick={() => setActive(null)}
            className={`block w-full text-start px-3 py-2 rounded-lg ${active === null ? "bg-slate-800" : "hover:bg-slate-800/50"}`}
          >
            {t.inbox}
          </button>
          {projects.map((p) => (
            <button
              key={p.id}
              onClick={() => setActive(p.id)}
              className={`flex items-center gap-2 w-full text-start px-3 py-2 rounded-lg ${active === p.id ? "bg-slate-800" : "hover:bg-slate-800/50"}`}
            >
              <span className="w-2 h-2 rounded-full" style={{ background: p.color }} />
              {p.name}
            </button>
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
              className="w-full bg-transparent text-sm px-3 py-2 text-slate-400 outline-none"
            />
          </form>
        </nav>

        <div className="mt-auto border-t border-slate-800 pt-2">
          <Pomodoro locale={locale} />
          <div className="flex gap-1 text-xs justify-center mt-2">
            <button onClick={() => setPrefs("en", calendar)} className={locale === "en" ? "text-indigo-400" : "text-slate-500"}>
              EN
            </button>
            <span className="text-slate-700">|</span>
            <button onClick={() => setPrefs("fa", calendar)} className={locale === "fa" ? "text-indigo-400" : "text-slate-500"}>
              فا
            </button>
            <span className="text-slate-700 mx-1">·</span>
            <button
              onClick={() => setPrefs(locale, "gregorian")}
              className={calendar === "gregorian" ? "text-indigo-400" : "text-slate-500"}
            >
              Greg
            </button>
            <span className="text-slate-700">|</span>
            <button
              onClick={() => setPrefs(locale, "jalali")}
              className={calendar === "jalali" ? "text-indigo-400" : "text-slate-500"}
            >
              Jalali
            </button>
          </div>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 flex flex-col max-w-3xl mx-auto w-full">
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          <form onSubmit={addQuick} className="mb-4">
            <input
              value={newTask}
              onChange={(e) => setNewTask(e.target.value)}
              placeholder={t.addTask}
              className="w-full rounded-lg bg-slate-800 px-4 py-3 outline-none focus:ring-2 ring-indigo-500"
            />
          </form>

          {tasks.length === 0 && <p className="text-center text-slate-500 mt-16">{t.noTasks}</p>}

          {tasks.map((task) => (
            <div key={task.id} className="group flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-slate-800/50">
              <input
                type="checkbox"
                checked={task.completed}
                onChange={() => toggle(task)}
                className="w-5 h-5 accent-indigo-500 shrink-0"
              />
              <span className={`flex-1 ${task.completed ? "line-through text-slate-500" : ""}`}>
                {task.priority > 0 && <span className={PRIO_COLOR[task.priority]}>!</span>} {task.title}
                {task.rrule && <span className="text-slate-500 text-xs ms-1">↻</span>}
              </span>
              {task.due_date && (
                <span className="text-xs text-slate-400">{fmtDate(task.due_date, locale, calendar)}</span>
              )}
              <button
                onClick={async () => {
                  await api.deleteTask(task.id);
                  refresh();
                }}
                className="opacity-0 group-hover:opacity-100 text-slate-500 hover:text-rose-400 text-sm"
                title={t.delete}
              >
                ✕
              </button>
            </div>
          ))}
        </div>

        <Chatbox locale={locale} onTasks={() => refresh()} />
      </main>
    </div>
  );
}
