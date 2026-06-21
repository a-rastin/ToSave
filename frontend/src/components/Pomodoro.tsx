import { useEffect, useRef, useState } from "react";
import { dict, type Locale } from "../i18n";

const WORK = 25 * 60;
const BREAK = 5 * 60;

export default function Pomodoro({ locale }: { locale: Locale }) {
  const t = dict[locale];
  const [mode, setMode] = useState<"work" | "break">("work");
  const [left, setLeft] = useState(WORK);
  const [running, setRunning] = useState(false);
  const ref = useRef<number | null>(null);

  useEffect(() => {
    if (!running) return;
    ref.current = window.setInterval(() => setLeft((s) => s - 1), 1000);
    return () => void (ref.current && clearInterval(ref.current));
  }, [running]);

  useEffect(() => {
    if (left > 0) return;
    // switch phase when the timer hits zero
    const next = mode === "work" ? "break" : "work";
    setMode(next);
    setLeft(next === "work" ? WORK : BREAK);
    new Audio("data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=").play().catch(() => {});
  }, [left, mode]);

  const mm = String(Math.floor(left / 60)).padStart(2, "0");
  const ss = String(left % 60).padStart(2, "0");

  return (
    <div className="text-center py-4">
      <p className="text-xs uppercase tracking-widest text-slate-400">
        {t.focus} · {mode === "work" ? t.work : t.break}
      </p>
      <p className="text-5xl font-mono my-2 tabular-nums">
        {mm}:{ss}
      </p>
      <div className="flex gap-2 justify-center">
        <button
          onClick={() => setRunning((r) => !r)}
          className="px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-sm"
        >
          {running ? t.pause : t.start}
        </button>
        <button
          onClick={() => {
            setRunning(false);
            setMode("work");
            setLeft(WORK);
          }}
          className="px-4 py-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-sm"
        >
          {t.reset}
        </button>
      </div>
    </div>
  );
}
