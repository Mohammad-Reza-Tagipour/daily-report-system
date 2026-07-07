"use client";

// app/report/page.tsx — employee view (frontend-only).
// NO redirect guard. Shows own calendar + notifications from admin.

import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  ChevronRight, ChevronLeft, LogOut, Calendar, Loader2,
  Save, AlertCircle, Lock, User, Bell, CheckCircle2, Clock,
} from "lucide-react";
import { GlassCard } from "@/components/ui/glass-card";
import { GlassButton } from "@/components/ui/glass-button";
import { ThemeToggle } from "@/components/shared/ThemeToggle";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";
import { useUserEntries, useUserNotifications, upsertEntry, markNotificationRead, type ReportEntry } from "@/lib/useStore";
import {
  toPersianDigits, persianMonthName, persianWeekdayOfJalaliDay, isFriday,
  daysOfMonth, shiftMonthKey, parseMonthKey, currentMonthKey, type JalaliMonthKey,
  isToday, isFutureDay, canEditDay,
} from "@/lib/jalali";

// Wrapper with Suspense — required by Next.js for useSearchParams.
export default function ReportPage() {
  return (
    <Suspense fallback={<Loading />}>
      <ReportInner />
    </Suspense>
  );
}

function ReportInner() {
  const router = useRouter();
  const search = useSearchParams();
  const { user, ready, logout } = useAuth();
  const forbidden = search.get("forbidden") === "1";

  if (!ready) return <Loading />;
  if (!user) return <LoginPrompt />;

  return <ReportContent user={user} forbidden={forbidden} onLogout={() => { logout(); router.push("/"); }} />;
}

function ReportContent({ user, forbidden, onLogout }: {
  user: { id: string; name: string; email: string; role: string };
  forbidden: boolean;
  onLogout: () => void;
}) {
  const router = useRouter();
  const search = useSearchParams();

  const monthParam = search.get("month");
  const month: JalaliMonthKey = monthParam && /^\d{4}-\d{2}$/.test(monthParam) ? monthParam : currentMonthKey();
  const { jy, jm } = parseMonthKey(month);
  const days = daysOfMonth(month);
  const monthLabel = `${persianMonthName(jm)} ${toPersianDigits(jy)}`;

  const { entries, loading: entriesLoading } = useUserEntries(user.id, month);
  const { notifications } = useUserNotifications(user.id);

  useEffect(() => { /* data fetched from API */ }, [month]);

  const entriesByDay: Record<number, ReportEntry> = {};
  for (const e of entries) entriesByDay[e.day] = e;
  // Count only entries that have at least one non-empty field.
  const filled = entries.filter(e => e.enterTime || e.leaveTime || e.task).length;
  const total = days.length, pct = total > 0 ? Math.round((filled / total) * 100) : 0;
  const unreadCount = notifications.filter(n => !n.read).length;

  const [nav, setNav] = useState(false);
  const go = (m: string) => { setNav(true); router.push(`/report?month=${m}`); setTimeout(() => setNav(false), 500); };

  // Auto-scroll to today — only ONCE when the month changes, not on every render.
  const todayRef = useRef<HTMLTableRowElement>(null);
  const scrolledMonthRef = useRef<string>("");
  useEffect(() => {
    if (scrolledMonthRef.current === month) return; // already scrolled for this month
    scrolledMonthRef.current = month;
    // Small delay so the table is fully rendered.
    const timer = setTimeout(() => {
      todayRef.current?.scrollIntoView({ block: "center", behavior: "smooth" });
    }, 100);
    return () => clearTimeout(timer);
  }, [month]);

  return (
    <div className="relative flex min-h-screen flex-col">
      <header className="sticky top-0 z-30 px-4 pt-4">
        <div className="glass glass-border mx-auto flex h-16 max-w-5xl items-center justify-between rounded-2xl px-4 sm:px-6">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/15 overflow-hidden"><img src="/logo.svg" alt="لوگو" className="h-7 w-7" /></div>
            <div className="leading-tight"><p className="text-sm font-bold tracking-tight">گزارش روزانه من</p><p className="text-[10px] text-muted-foreground">{user.name}</p></div>
          </Link>
          <div className="flex items-center gap-2">
            {user.role === "ADMIN" && <Link href="/dashboard"><GlassButton variant="ghost" size="sm">داشبورد مدیر</GlassButton></Link>}
            <ThemeToggle />
            <GlassButton variant="ghost" size="icon" aria-label="خروج" onClick={onLogout}><LogOut className="h-4 w-4" /></GlassButton>
          </div>
        </div>
      </header>

      <motion.main initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="mx-auto w-full max-w-5xl flex-1 px-4 py-6 sm:px-6">
        {forbidden && (
          <div className="mb-4 flex items-center gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-300">
            <AlertCircle className="h-4 w-4" /> دسترسی به داشبورد فقط برای مدیران است.
          </div>
        )}

        {/* Header */}
        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">تقویم گزارش‌های من</h1>
            <p className="mt-1 flex items-center gap-2 text-sm text-muted-foreground"><Lock className="h-3.5 w-3.5" /> شما فقط سلول‌های خودتان را ویرایش می‌کنید.</p>
          </div>
          <div className="flex items-center gap-2">
            <GlassButton variant="glass" size="icon" onClick={() => go(shiftMonthKey(month, -1))} disabled={nav}><ChevronRight className="h-4 w-4" /></GlassButton>
            <div className="glass glass-border flex min-w-[180px] items-center justify-center gap-2 rounded-xl px-4 py-2"><span className="text-base font-semibold">{monthLabel}</span>{nav && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}</div>
            <GlassButton variant="glass" size="icon" onClick={() => go(shiftMonthKey(month, 1))} disabled={nav}><ChevronLeft className="h-4 w-4" /></GlassButton>
            <GlassButton variant="ghost" size="sm" onClick={() => go(currentMonthKey())} disabled={nav} className="mr-1">ماه جاری</GlassButton>
          </div>
        </div>

        {/* Notifications section */}
        {notifications.length > 0 && (
          <GlassCard className="mb-4 overflow-hidden p-0">
            <div className="flex items-center gap-2 border-b border-border/50 px-4 py-3">
              <Bell className="h-4 w-4 text-primary" />
              <h2 className="text-sm font-semibold">وظایف ارجاع‌شده توسط مدیر</h2>
              {unreadCount > 0 && <span className="rounded-full bg-rose-500/20 px-2 py-0.5 text-[10px] font-bold text-rose-600">{toPersianDigits(unreadCount)} جدید</span>}
            </div>
            <div className="space-y-2 p-3">
              {notifications.map(n => <NotifRow key={n.id} notif={n} onRead={() => { markNotificationRead(n.id); }} />)}
            </div>
          </GlassCard>
        )}

        {/* Progress strip */}
        <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <GlassCard className="p-4"><div className="flex items-center gap-2 text-xs text-muted-foreground"><User className="h-4 w-4 text-primary" /> کاربر</div><p className="mt-1 truncate text-base font-semibold">{user.name}</p><p className="truncate text-[11px] text-muted-foreground" dir="ltr">{user.email}</p></GlassCard>
          <GlassCard className="p-4"><div className="flex items-center gap-2 text-xs text-muted-foreground"><Calendar className="h-4 w-4 text-emerald-500" /> روزهای ماه</div><p className="mt-1 text-2xl font-bold tabular-nums">{toPersianDigits(total)}</p></GlassCard>
          <GlassCard className="p-4"><div className="flex items-center gap-2 text-xs text-muted-foreground"><Save className="h-4 w-4 text-amber-500" /> درصد تکمیل</div><p className="mt-1 text-2xl font-bold tabular-nums">{toPersianDigits(pct)}٪</p><div className="mt-2 h-2 overflow-hidden rounded-full bg-foreground/10"><div className="h-full bg-primary transition-all" style={{ width: `${pct}%` }} /></div></GlassCard>
        </div>

        {/* Calendar table */}
        <GlassCard className="overflow-hidden p-0">
          <div className="border-b border-border/50 px-4 py-3"><h2 className="text-sm font-semibold">گزارش‌های {monthLabel}</h2><p className="text-xs text-muted-foreground">ذخیره خودکار با خروج از سلول.</p></div>
          <div className="scroll-area max-h-[640px] overflow-y-auto">
            <table className="w-full border-collapse text-sm">
              <thead className="sticky top-0 z-10 bg-background/95 backdrop-blur"><tr className="border-b border-border/60">
                <th className="min-w-[140px] px-4 py-3 text-right text-xs font-semibold text-muted-foreground">روز</th>
                <th className="min-w-[140px] px-4 py-3 text-center text-xs font-semibold text-muted-foreground">ورود</th>
                <th className="min-w-[140px] px-4 py-3 text-center text-xs font-semibold text-muted-foreground">خروج</th>
                <th className="min-w-[260px] px-4 py-3 text-right text-xs font-semibold text-muted-foreground">وظیفه</th>
              </tr></thead>
              <tbody>
                {days.map(day => {
                  const friday = isFriday(jy, jm, day);
                  const weekday = persianWeekdayOfJalaliDay(jy, jm, day);
                  const today = isToday(jy, jm, day);
                  const future = isFutureDay(jy, jm, day);
                  const editable = canEditDay(jy, jm, day);
                  return (
                    <tr key={day} ref={today ? todayRef : undefined} className={`${friday ? "bg-rose-500/5" : ""} ${today ? "ring-2 ring-primary/40 ring-inset" : ""} ${future ? "opacity-40" : ""}`}>
                      <td className="whitespace-nowrap border-b border-border/40 px-4 py-2">
                        <div className="flex items-center gap-2">
                          <span className={`flex h-7 w-7 items-center justify-center rounded-lg text-xs font-bold tabular-nums ${today ? "bg-primary text-primary-foreground" : friday ? "bg-rose-500/20 text-rose-600 dark:text-rose-300" : "bg-foreground/5 text-foreground/80"}`}>{toPersianDigits(day)}</span>
                          <div className="flex flex-col">
                            <span className={`text-xs ${today ? "text-primary font-bold" : friday ? "text-rose-600 dark:text-rose-300 font-semibold" : "text-muted-foreground"}`}>{weekday}</span>
                            {today && <span className="text-[9px] text-primary font-medium">امروز</span>}
                          </div>
                        </div>
                      </td>
                      <CellEditor userId={user.id} month={month} day={day} initial={entriesByDay[day]} readOnly={!editable} />
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </GlassCard>
      </motion.main>
      <footer className="mt-auto px-4 pb-5 pt-2 text-center text-xs text-muted-foreground">
        سامانه‌ی گزارش روزانه · {toPersianDigits(new Date().getFullYear())}
        <br />
        <span className="mt-1 inline-block">ساخته‌شده توسط <span className="font-semibold text-foreground/80">Mohammad Reza Tagipour</span></span>
      </footer>
    </div>
  );
}

// ---------- Notification row ----------

function NotifRow({ notif, onRead }: {
  notif: { id: string; title: string; details: string; dueDate?: string | null; read: boolean; createdAt: number };
  onRead: () => void;
}) {
  const timeStr = new Date(notif.createdAt).toLocaleDateString("fa-IR");
  return (
    <div className={`rounded-xl border p-3 transition ${notif.read ? "border-border/40 bg-background/30" : "border-primary/30 bg-primary/5"}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            {!notif.read && <span className="h-2 w-2 shrink-0 rounded-full bg-rose-500" />}
            <p className="text-sm font-semibold">{notif.title}</p>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">{notif.details}</p>
          <div className="mt-2 flex items-center gap-3 text-[10px] text-muted-foreground">
            <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> {timeStr}</span>
            {notif.dueDate && <span className="flex items-center gap-1"><Calendar className="h-3 w-3" /> مهلت: {notif.dueDate}</span>}
          </div>
        </div>
        {!notif.read && (
          <GlassButton variant="ghost" size="sm" onClick={onRead} className="shrink-0">
            <CheckCircle2 className="h-4 w-4" /> خواندم
          </GlassButton>
        )}
      </div>
    </div>
  );
}

// ---------- Cell editor ----------

function CellEditor({ userId, month, day, initial, readOnly }: { userId: string; month: JalaliMonthKey; day: number; initial?: ReportEntry; readOnly?: boolean }) {
  const [enterTime, setEnterTime] = useState(initial?.enterTime ?? "");
  const [leaveTime, setLeaveTime] = useState(initial?.leaveTime ?? "");
  const [task, setTask] = useState(initial?.task ?? "");
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  useEffect(() => { setEnterTime(initial?.enterTime ?? ""); setLeaveTime(initial?.leaveTime ?? ""); setTask(initial?.task ?? ""); setDirty(false); }, [initial?.id, month, day]);

  const mark = <T,>(s: (v: T) => void) => (v: T) => { s(v); setDirty(true); };
  const save = async () => {
    if (!dirty || readOnly) return; setSaving(true);
    try { await upsertEntry({ userId, month, day, enterTime: enterTime || null, leaveTime: leaveTime || null, task: task || null }); setDirty(false); }
    finally { setSaving(false); }
  };

  if (readOnly) {
    // Read-only: show text instead of inputs.
    return (
      <>
        <td className="border-b border-border/40 px-4 py-2 text-center text-sm tabular-nums text-muted-foreground">{enterTime || "—"}</td>
        <td className="border-b border-border/40 px-4 py-2 text-center text-sm tabular-nums text-muted-foreground">{leaveTime || "—"}</td>
        <td className="border-b border-border/40 px-4 py-2 text-xs text-muted-foreground">{task || "قفل شده"}</td>
      </>
    );
  }

  return (
    <>
      <td className="border-b border-border/40 px-4 py-2 text-center"><input type="time" value={enterTime} onChange={e => mark(setEnterTime)(e.target.value)} onBlur={save} dir="ltr" className="h-9 w-28 rounded-md border border-border bg-background/60 px-2 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary/40" /></td>
      <td className="border-b border-border/40 px-4 py-2 text-center"><input type="time" value={leaveTime} onChange={e => mark(setLeaveTime)(e.target.value)} onBlur={save} dir="ltr" className="h-9 w-28 rounded-md border border-border bg-background/60 px-2 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary/40" /></td>
      <td className="border-b border-border/40 px-4 py-2"><div className="relative"><textarea value={task} onChange={e => mark(setTask)(e.target.value)} onBlur={save} rows={1} placeholder="شرح..." className="w-full resize-none rounded-md border border-border bg-background/60 px-2 py-1.5 text-xs outline-none focus:border-primary focus:ring-1 focus:ring-primary/40" />{saving && <div className="absolute -bottom-5 left-1 flex items-center gap-1 text-[10px] text-muted-foreground"><Loader2 className="h-3 w-3 animate-spin" /> ذخیره...</div>}</div></td>
    </>
  );
}

// ---------- Shared UI ----------

function Loading() {
  return <div className="flex min-h-screen items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
}

function LoginPrompt() {
  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <GlassCard variant="strong" className="max-w-md p-8 text-center">
        <Lock className="mx-auto mb-3 h-10 w-10 text-primary" />
        <h1 className="text-xl font-bold">برای دیدن گزارش خود وارد شوید</h1>
        <p className="mt-2 text-sm text-muted-foreground">برای ادامه وارد حساب کاربری خود شوید.</p>
        <div className="mt-5 flex justify-center gap-2">
          <Link href="/login"><GlassButton variant="primary" size="lg">ورود</GlassButton></Link>
          <Link href="/"><GlassButton variant="glass" size="lg">خانه</GlassButton></Link>
        </div>
      </GlassCard>
    </div>
  );
}
