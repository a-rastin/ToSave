import { useRef, useState } from "react";
import { api, type Task } from "../api";
import { dict, type Locale } from "../i18n";

export default function Chatbox({ locale, onTasks }: { locale: Locale; onTasks: (t: Task[]) => void }) {
  const t = dict[locale];
  const [msg, setMsg] = useState("");
  const [reply, setReply] = useState("");
  const [busy, setBusy] = useState(false);
  const [listening, setListening] = useState(false);
  const recRef = useRef<any>(null);

  async function send(text: string) {
    if (!text.trim()) return;
    setBusy(true);
    setMsg("");
    try {
      const res = await api.chat(text);
      setReply(res.reply);
      if (res.created_tasks.length) onTasks(res.created_tasks);
    } finally {
      setBusy(false);
    }
  }

  function toggleVoice() {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) {
      setReply("Voice not supported in this browser.");
      return;
    }
    if (listening) {
      recRef.current?.stop();
      return;
    }
    const rec = new SR();
    rec.lang = locale === "fa" ? "fa-IR" : "en-US";
    rec.interimResults = false;
    rec.onresult = (e: any) => send(e.results[0][0].transcript);
    rec.onend = () => setListening(false);
    rec.start();
    recRef.current = rec;
    setListening(true);
  }

  return (
    <div className="border-t border-slate-800 p-3 space-y-2">
      {reply && <p className="text-sm text-cyan-300 px-1">{reply}</p>}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          send(msg);
        }}
        className="flex gap-2"
      >
        <input
          className="flex-1 rounded-lg bg-slate-800 px-4 py-3 outline-none focus:ring-2 ring-indigo-500"
          placeholder={t.askPlaceholder}
          value={msg}
          onChange={(e) => setMsg(e.target.value)}
        />
        <button
          type="button"
          onClick={toggleVoice}
          title={t.listen}
          className={`px-3 rounded-lg ${listening ? "bg-rose-600" : "bg-slate-700 hover:bg-slate-600"}`}
        >
          🎤
        </button>
        <button
          disabled={busy}
          className="px-4 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 font-medium"
        >
          {t.send}
        </button>
      </form>
    </div>
  );
}
