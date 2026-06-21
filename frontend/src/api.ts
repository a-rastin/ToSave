const BASE = import.meta.env.VITE_API_URL || "http://localhost:8000";

export type Task = {
  id: number;
  title: string;
  notes: string | null;
  priority: number;
  position: number;
  due_date: string | null;
  rrule: string | null;
  project_id: number | null;
  parent_id: number | null;
  completed: boolean;
  created_at: string;
  completed_at: string | null;
  label_ids: number[];
};
export type Project = { id: number; name: string; color: string; position: number };
export type PomodoroStats = { today_seconds: number; by_day: Record<string, number> };

function getTokens() {
  return {
    access: localStorage.getItem("access") || "",
    refresh: localStorage.getItem("refresh") || "",
  };
}
export function setTokens(access: string, refresh: string) {
  localStorage.setItem("access", access);
  localStorage.setItem("refresh", refresh);
}
export function clearTokens() {
  localStorage.removeItem("access");
  localStorage.removeItem("refresh");
}
export function isLoggedIn() {
  return !!localStorage.getItem("access");
}

async function refresh(): Promise<boolean> {
  const { refresh } = getTokens();
  if (!refresh) return false;
  const r = await fetch(`${BASE}/auth/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refresh_token: refresh }),
  });
  if (!r.ok) return false;
  const d = await r.json();
  setTokens(d.access_token, d.refresh_token);
  return true;
}

async function req(path: string, opts: RequestInit = {}, retry = true): Promise<Response> {
  const { access } = getTokens();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(opts.headers as Record<string, string>),
  };
  if (access) headers.Authorization = `Bearer ${access}`;
  const r = await fetch(`${BASE}${path}`, { ...opts, headers });
  if (r.status === 401 && retry && (await refresh())) return req(path, opts, false);
  return r;
}

export const api = {
  async signup(email: string, password: string) {
    const r = await fetch(`${BASE}/auth/signup`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    if (!r.ok) throw new Error((await r.json()).detail || "Signup failed");
    const d = await r.json();
    setTokens(d.access_token, d.refresh_token);
  },
  async login(email: string, password: string) {
    const body = new URLSearchParams({ username: email, password });
    const r = await fetch(`${BASE}/auth/login`, { method: "POST", body });
    if (!r.ok) throw new Error("Bad credentials");
    const d = await r.json();
    setTokens(d.access_token, d.refresh_token);
  },
  async me() {
    return (await req("/auth/me")).json();
  },
  async savePrefs(prefs: { locale?: string; calendar?: string }) {
    await req("/auth/me", { method: "PATCH", body: JSON.stringify(prefs) });
  },
  async tasks(params: Record<string, string> = {}): Promise<Task[]> {
    const q = new URLSearchParams(params).toString();
    return (await req(`/tasks${q ? "?" + q : ""}`)).json();
  },
  async addTask(t: Partial<Task>): Promise<Task> {
    return (await req("/tasks", { method: "POST", body: JSON.stringify(t) })).json();
  },
  async updateTask(id: number, t: Partial<Task>): Promise<Task> {
    return (await req(`/tasks/${id}`, { method: "PATCH", body: JSON.stringify(t) })).json();
  },
  async deleteTask(id: number) {
    await req(`/tasks/${id}`, { method: "DELETE" });
  },
  async projects(): Promise<Project[]> {
    return (await req("/projects")).json();
  },
  async addProject(name: string): Promise<Project> {
    return (await req("/projects", { method: "POST", body: JSON.stringify({ name }) })).json();
  },
  async updateProject(id: number, data: Partial<Project>): Promise<Project> {
    return (await req(`/projects/${id}`, { method: "PATCH", body: JSON.stringify(data) })).json();
  },
  async reorderProjects(ids: number[]) {
    await req("/projects/reorder", { method: "POST", body: JSON.stringify({ ids }) });
  },
  async reorderTasks(ids: number[]) {
    await req("/tasks/reorder", { method: "POST", body: JSON.stringify({ ids }) });
  },
  async pomodoroStats(): Promise<PomodoroStats> {
    return (await req("/pomodoro/stats")).json();
  },
  async logPomodoro(seconds: number, task_id?: number): Promise<PomodoroStats> {
    return (await req("/pomodoro/log", { method: "POST", body: JSON.stringify({ seconds, task_id }) })).json();
  },
  async chat(message: string): Promise<{ reply: string; created_tasks: Task[] }> {
    return (await req("/ai/chat", { method: "POST", body: JSON.stringify({ message }) })).json();
  },
};
