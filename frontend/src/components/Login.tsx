import { useState } from "react";
import { api } from "../api";
import { dict, type Locale } from "../i18n";

export default function Login({ locale, onAuthed }: { locale: Locale; onAuthed: () => void }) {
  const t = dict[locale];
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr("");
    try {
      if (mode === "signup") await api.signup(email, password);
      else await api.login(email, password);
      onAuthed();
    } catch (e) {
      setErr((e as Error).message);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <form onSubmit={submit} className="w-full max-w-sm space-y-4">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold">{t.appName}</h1>
          <p className="text-muted mt-1">{t.tagline}</p>
        </div>
        <input
          className="w-full rounded-lg bg-panel px-4 py-3 outline-none focus:ring-2 ring-indigo-500"
          type="email"
          placeholder={t.email}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <input
          className="w-full rounded-lg bg-panel px-4 py-3 outline-none focus:ring-2 ring-indigo-500"
          type="password"
          placeholder={t.password}
          minLength={8}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        {err && <p className="text-rose-400 text-sm">{err}</p>}
        <button className="w-full rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white py-3 font-medium transition">
          {mode === "login" ? t.login : t.signup}
        </button>
        <button
          type="button"
          onClick={() => setMode(mode === "login" ? "signup" : "login")}
          className="w-full text-muted text-sm hover:text-fg"
        >
          {mode === "login" ? t.needAccount : t.haveAccount}
        </button>
      </form>
    </div>
  );
}
