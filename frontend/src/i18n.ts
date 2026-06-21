export type Locale = "en" | "fa";

export const dict = {
  en: {
    dir: "ltr",
    appName: "Gord",
    tagline: "Say it. It becomes a task.",
    email: "Email",
    password: "Password",
    login: "Log in",
    signup: "Sign up",
    logout: "Log out",
    haveAccount: "Have an account? Log in",
    needAccount: "New here? Sign up",
    inbox: "Inbox",
    today: "Today",
    projects: "Projects",
    newProject: "New project…",
    addTask: "Add a task…",
    noTasks: "Nothing here. Enjoy the quiet.",
    askPlaceholder: "Tell me what to do… e.g. “call mom tomorrow, urgent”",
    send: "Send",
    listen: "Voice",
    done: "done",
    delete: "Delete",
    priority: ["none", "low", "medium", "urgent"],
    focus: "Focus",
    start: "Start",
    pause: "Pause",
    reset: "Reset",
    work: "Work",
    break: "Break",
  },
  fa: {
    dir: "rtl",
    appName: "گـُرد",
    tagline: "بگو، تبدیل به کار می‌شود.",
    email: "ایمیل",
    password: "رمز عبور",
    login: "ورود",
    signup: "ثبت‌نام",
    logout: "خروج",
    haveAccount: "حساب دارید؟ وارد شوید",
    needAccount: "تازه‌وارد؟ ثبت‌نام کنید",
    inbox: "صندوق ورودی",
    today: "امروز",
    projects: "پروژه‌ها",
    newProject: "پروژهٔ جدید…",
    addTask: "افزودن کار…",
    noTasks: "اینجا خالی است. از آرامش لذت ببرید.",
    askPlaceholder: "بگو چه کنم… مثلاً «فردا به مامان زنگ بزن، فوری»",
    send: "ارسال",
    listen: "صدا",
    done: "انجام شد",
    delete: "حذف",
    priority: ["بدون", "کم", "متوسط", "فوری"],
    focus: "تمرکز",
    start: "شروع",
    pause: "توقف",
    reset: "بازنشانی",
    work: "کار",
    break: "استراحت",
  },
} as const;

export type T = (typeof dict)["en"];

export function fmtDate(d: string | null, locale: Locale, calendar: "gregorian" | "jalali"): string {
  if (!d) return "";
  // Native dual-calendar via Intl — no date library needed.
  const opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" };
  const loc =
    calendar === "jalali" ? "fa-IR-u-ca-persian" : locale === "fa" ? "fa-IR" : "en-US";
  return new Intl.DateTimeFormat(loc, opts).format(new Date(d + "T00:00:00"));
}
