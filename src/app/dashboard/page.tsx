"use client";

// app/dashboard/page.tsx — admin dashboard (frontend-only).
// NO redirect guard. If not authed or not admin, show a prompt instead.

import { Suspense, useEffect, useState, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  ChevronRight, ChevronLeft, Plus, LogOut, Calendar, UserPlus,
  Loader2, Users, Save, FileText, AlertCircle, Bell, Send, ShieldCheck, Lock,
  Trash2, UserCheck, RotateCcw, Clock, UserX,
  Palmtree, Megaphone, MessageSquare,
} from "lucide-react";
import { GlassCard } from "@/components/ui/glass-card";
import { GlassButton } from "@/components/ui/glass-button";
import { ThemeToggle } from "@/components/shared/ThemeToggle";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";
import {
  useEmployees, useAllUsers, usePendingUsers, useDeletedUsers, useMonthEntries, useAllNotifications, useEntryCount,
  useAllLeaves, useAnnouncements, useConversations, useConversation,
  upsertEntry, addUser, toggleUserRole, approveUser, restoreUser, deleteUser, createNotification,
  resolveLeaveRequest, createAnnouncement, markAnnouncementRead, sendMessage,
} from "@/lib/useStore";
import { type User, type ReportEntry, type LeaveRequest, type Announcement as AnnouncementType, type Conversation, type DirectMessage } from "@/lib/useStore";
import { isMainAdmin } from "@/lib/constants";
import {
  toPersianDigits, persianMonthName, persianWeekdayOfJalaliDay, isFriday,
  daysOfMonth, shiftMonthKey, parseMonthKey, currentMonthKey, type JalaliMonthKey,
  isToday, isFutureDay, canEditDay, todayJalaliDay,
} from "@/lib/jalali";

// Wrapper with Suspense — required by Next.js for useSearchParams.
export default function DashboardPage() {
  return (
    <Suspense fallback={<Loading />}>
      <DashboardInner />
    </Suspense>
  );
}

function DashboardInner() {
  const router = useRouter();
  const { user, ready, logout, addEmployee, refreshUser } = useAuth();

  // Show nothing while loading.
  if (!ready) return <Loading />;

  // If not logged in — show login prompt (NO redirect).
  if (!user) return <LoginPrompt title="برای دیدن داشبورد وارد شوید" />;

  // If logged in but not admin — show access denied with user info + logout (NO redirect).
  if (user.role !== "ADMIN") return <AccessDenied user={user} />;

  return <DashboardContent user={user} onLogout={() => { logout(); router.push("/"); }} onAddEmployee={addEmployee} onRefreshUser={refreshUser} />;
}

// ---------- Dashboard content (admin only) ----------

function DashboardContent({ user, onLogout, onAddEmployee, onRefreshUser }: {
  user: User;
  onLogout: () => void;
  onAddEmployee: (input: { name: string; email: string }) => { ok: true; user: User } | { ok: false; error: string };
  onRefreshUser: () => void;
}) {
  const router = useRouter();
  const search = useSearchParams();
  const [tab, setTab] = useState<"calendar" | "users" | "assign" | "leaves" | "announcements" | "messages">("calendar");

  const monthParam = search.get("month");
  const month: JalaliMonthKey = monthParam && /^\d{4}-\d{2}$/.test(monthParam) ? monthParam : currentMonthKey();

  return (
    <div className="relative flex min-h-screen flex-col">
      <Topbar userName={user.name} onLogout={onLogout} />

      <main className="mx-auto w-full max-w-[1400px] flex-1 px-4 py-6 sm:px-6">
        {/* Tabs */}
        <div className="mb-5 flex flex-wrap gap-2">
          <TabButton active={tab === "calendar"} onClick={() => setTab("calendar")} icon={Calendar} label="تقویم" />
          <TabButton active={tab === "users"} onClick={() => setTab("users")} icon={Users} label="کاربران" />
          <TabButton active={tab === "assign"} onClick={() => setTab("assign")} icon={Bell} label="ارجاع وظیفه" />
          <TabButton active={tab === "leaves"} onClick={() => setTab("leaves")} icon={Palmtree} label="مرخصی" />
          <TabButton active={tab === "announcements"} onClick={() => setTab("announcements")} icon={Megaphone} label="اعلان‌ها" />
          <TabButton active={tab === "messages"} onClick={() => setTab("messages")} icon={MessageSquare} label="پیام‌ها" />
        </div>

        {tab === "calendar" && <CalendarTab month={month} router={router} />}
        {tab === "users" && <UsersTab currentUserId={user.id} onToggleRole={async (id) => { const res = await toggleUserRole(id); if (!res.ok) { toast.error("خطا", { description: res.error }); } else { onRefreshUser(); } }} />}
        {tab === "assign" && <AssignTab adminId={user.id} />}
        {tab === "leaves" && <LeavesAdminTab />}
        {tab === "announcements" && <AnnouncementsAdminTab adminId={user.id} />}
        {tab === "messages" && <MessagesTab currentUserId={user.id} currentUserName={user.name} />}
      </main>

      <footer className="mt-auto px-4 pb-5 pt-2 text-center text-xs text-muted-foreground">
        سامانه‌ی گزارش روزانه · {toPersianDigits(new Date().getFullYear())}
        <br />
        <span className="mt-1 inline-block">ساخته‌شده توسط <span className="font-semibold text-foreground/80">Mohammad Reza Tagipour</span></span>
      </footer>
    </div>
  );
}

// ---------- Calendar tab (admin sees ALL employees) ----------

function CalendarTab({ month, router }: { month: JalaliMonthKey; router: ReturnType<typeof useRouter> }) {
  const { jy, jm } = parseMonthKey(month);
  const days = daysOfMonth(month);
  const monthLabel = `${persianMonthName(jm)} ${toPersianDigits(jy)}`;
  const { users: employees, loading: employeesLoading } = useEmployees();
  const { entries, loading: entriesLoading } = useMonthEntries(month);

  useEffect(() => { /* data is fetched from API — no seeding needed */ }, [month]);

  const entriesByUser: Record<string, Record<number, ReportEntry>> = {};
  for (const e of entries) (entriesByUser[e.userId] ??= {})[e.day] = e;
  const fridayCount = days.filter(d => isFriday(jy, jm, d)).length;

  const [nav, setNav] = useState(false);
  const go = (m: string) => { setNav(true); router.push(`/dashboard?month=${m}`); setTimeout(() => setNav(false), 500); };
  const [addOpen, setAddOpen] = useState(false);

  // Auto-scroll to today — only ONCE when the month changes, not on every render.
  const todayRef = useRef<HTMLTableRowElement>(null);
  const scrolledMonthRef = useRef<string>("");
  useEffect(() => {
    if (scrolledMonthRef.current === month) return; // already scrolled for this month
    scrolledMonthRef.current = month;
    const timer = setTimeout(() => {
      todayRef.current?.scrollIntoView({ block: "center", behavior: "smooth" });
    }, 100);
    return () => clearTimeout(timer);
  }, [month]);

  return (
    <>
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">تقویم گزارش‌های ماهانه</h1>
          <p className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
            <Calendar className="h-3.5 w-3.5" /> ویرایش ورود/خروج و وظایف همه‌ی کارکنان
          </p>
        </div>
        <div className="flex items-center gap-2">
          <GlassButton variant="glass" size="icon" onClick={() => go(shiftMonthKey(month, -1))} disabled={nav}><ChevronRight className="h-4 w-4" /></GlassButton>
          <div className="glass glass-border flex min-w-[180px] items-center justify-center gap-2 rounded-xl px-4 py-2">
            <span className="text-base font-semibold">{monthLabel}</span>{nav && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
          </div>
          <GlassButton variant="glass" size="icon" onClick={() => go(shiftMonthKey(month, 1))} disabled={nav}><ChevronLeft className="h-4 w-4" /></GlassButton>
          <GlassButton variant="ghost" size="sm" onClick={() => go(currentMonthKey())} disabled={nav} className="mr-1">ماه جاری</GlassButton>
          <AddEmpDialog open={addOpen} onOpenChange={setAddOpen} onAdd={addUser} />
        </div>
      </div>

      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard icon={Users} label="کارکنان" value={employees.length} color="text-primary" />
        <StatCard icon={Calendar} label="روزهای ماه" value={days.length} color="text-emerald-500" />
        <StatCard icon={Save} label="سلول‌های پرشده" value={entries.length} color="text-amber-500" />
        <StatCard icon={AlertCircle} label="جمعه‌ها" value={fridayCount} color="text-rose-500" />
      </div>

      {employees.length === 0 ? (
        <GlassCard className="p-12 text-center text-muted-foreground">هنوز کارمندی ثبت نشده است.</GlassCard>
      ) : (
        <DragScroll>
          <table className="w-full border-collapse text-sm">
            <thead><tr>
              <th className="sticky right-0 z-20 min-w-[120px] bg-background/80 px-3 py-3 text-right text-xs font-semibold text-muted-foreground backdrop-blur">روز</th>
              {employees.map(emp => (
                <th key={emp.id} className="min-w-[260px] px-3 py-3 text-center text-xs font-semibold text-foreground">
                  <div className="flex flex-col items-center gap-0.5"><span>{emp.name}</span><span className="text-[10px] text-muted-foreground" dir="ltr">{emp.email}</span></div>
                </th>
              ))}
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
                    <td className={`sticky right-0 z-10 whitespace-nowrap border-b border-border/40 px-3 py-2 backdrop-blur ${friday ? "bg-rose-500/10" : today ? "bg-primary/10" : "bg-background/80"}`}>
                      <div className="flex items-center gap-2">
                        <span className={`flex h-7 w-7 items-center justify-center rounded-lg text-xs font-bold tabular-nums ${today ? "bg-primary text-primary-foreground" : friday ? "bg-rose-500/20 text-rose-600 dark:text-rose-300" : "bg-foreground/5 text-foreground/80"}`}>
                          {toPersianDigits(day)}
                        </span>
                        <div className="flex flex-col">
                          <span className={`text-xs ${today ? "text-primary font-bold" : friday ? "text-rose-600 dark:text-rose-300 font-semibold" : "text-muted-foreground"}`}>{weekday}</span>
                          {today && <span className="text-[9px] text-primary font-medium">امروز</span>}
                        </div>
                      </div>
                    </td>
                    {employees.map(emp => (
                      <td key={emp.id} className="border-b border-border/40 px-2 py-2 align-top">
                        <CellEditor userId={emp.id} month={month} day={day} initial={entriesByUser[emp.id]?.[day]} readOnly={!editable} />
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </DragScroll>
      )}
    </>
  );
}

// ---------- Users tab (admin manages roles) ----------

function UsersTab({ currentUserId, onToggleRole }: { currentUserId: string; onToggleRole: (userId: string) => void }) {
  const { users: allUsers } = useAllUsers();
  const { users: pendingUsers } = usePendingUsers();
  const { users: deletedUsers } = useDeletedUsers();
  const currentUser = allUsers.find(u => u.id === currentUserId);
  const viewerIsMainAdmin = currentUser ? isMainAdmin(currentUser.email) : false;

  return (
    <>
      <div className="mb-5">
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">مدیریت کاربران</h1>
        <p className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
          <Users className="h-3.5 w-3.5" /> مدیر اصلی قابل تغییر نیست
          {viewerIsMainAdmin && " — شما می‌توانید مدیران را تنزل دهید"}
        </p>
      </div>

      {/* Pending approvals */}
      {pendingUsers.length > 0 && (
        <div className="mb-6">
          <h2 className="mb-3 flex items-center gap-2 text-lg font-bold text-amber-600">
            <Clock className="h-5 w-5" /> در انتظار تأیید ({toPersianDigits(pendingUsers.length)})
          </h2>
          <div className="grid gap-3">
            {pendingUsers.map(u => (
              <PendingUserRow
                key={u.id}
                user={u}
                onApprove={async () => { const res = await approveUser(u.id); if (!res.ok) { toast.error("خطا", { description: res.error }); } }}
                onDelete={async () => { const res = await deleteUser(u.id); if (!res.ok) { toast.error("خطا", { description: res.error }); } else { toast.success("کاربر حذف شد"); } }}
              />
            ))}
          </div>
        </div>
      )}

      {/* Active users */}
      <h2 className="mb-3 flex items-center gap-2 text-lg font-bold">
        <Users className="h-5 w-5 text-primary" /> کاربران فعال ({toPersianDigits(allUsers.length)})
      </h2>
      <div className="grid gap-3 mb-6">
        {allUsers.map(u => (
          <UserRow
            key={u.id}
            user={u}
            isSelf={u.id === currentUserId}
            viewerIsMainAdmin={viewerIsMainAdmin}
            onToggle={() => onToggleRole(u.id)}
            onDelete={async () => {
              if (!confirm(`آیا از حذف «${u.name}» مطمئن هستید؟ داده‌های او حفظ می‌شود.`)) return;
              const res = await deleteUser(u.id);
              if (!res.ok) { toast.error("خطا", { description: res.error }); }
              else { toast.success("کاربر حذف شد"); }
            }}
          />
        ))}
      </div>

      {/* Deleted users */}
      {deletedUsers.length > 0 && (
        <div className="mb-6">
          <h2 className="mb-3 flex items-center gap-2 text-lg font-bold text-muted-foreground">
            <UserX className="h-5 w-5" /> کاربران حذف‌شده ({toPersianDigits(deletedUsers.length)})
          </h2>
          <p className="mb-3 text-xs text-muted-foreground">داده‌های این کاربران حفظ شده است. می‌توانید آن‌ها را بازگردانید.</p>
          <div className="grid gap-3">
            {deletedUsers.map(u => (
              <DeletedUserRow
                key={u.id}
                user={u}
                onRestore={async () => { const res = await restoreUser(u.id); if (!res.ok) { toast.error("خطا", { description: res.error }); } else { toast.success("کاربر بازگردانده شد"); } }}
              />
            ))}
          </div>
        </div>
      )}
    </>
  );
}

function PendingUserRow({ user, onApprove, onDelete }: {
  user: User;
  onApprove: () => Promise<void>;
  onDelete: () => Promise<void>;
}) {
  const [loading, setLoading] = useState(false);
  const approve = async () => { setLoading(true); try { await onApprove(); toast.success(`${user.name} تأیید شد`); } finally { setLoading(false); } };
  const del = async () => { setLoading(true); try { await onDelete(); } finally { setLoading(false); } };

  return (
    <GlassCard className="flex items-center justify-between border-amber-500/30 bg-amber-500/5 p-4">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/15 text-amber-600">
          <Clock className="h-5 w-5" />
        </div>
        <div>
          <p className="text-sm font-semibold">{user.name}</p>
          <p className="text-[11px] text-muted-foreground" dir="ltr">{user.email}</p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={approve}
          disabled={loading}
          className="flex items-center gap-1 rounded-xl bg-emerald-500/15 px-3 py-1.5 text-xs font-medium text-emerald-600 transition hover:bg-emerald-500/25"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserCheck className="h-4 w-4" />}
          تأیید
        </button>
        <button
          onClick={del}
          disabled={loading}
          className="rounded-xl border border-rose-500/30 px-3 py-1.5 text-xs font-medium text-rose-600 transition hover:bg-rose-500/10"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
    </GlassCard>
  );
}

function DeletedUserRow({ user, onRestore }: {
  user: User;
  onRestore: () => Promise<void>;
}) {
  const [loading, setLoading] = useState(false);
  const restore = async () => { setLoading(true); try { await onRestore(); } finally { setLoading(false); } };

  return (
    <GlassCard className="flex items-center justify-between opacity-60 p-4">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-foreground/5 text-muted-foreground">
          <UserX className="h-5 w-5" />
        </div>
        <div>
          <p className="text-sm font-semibold">{user.name}</p>
          <p className="text-[11px] text-muted-foreground" dir="ltr">{user.email}</p>
        </div>
      </div>
      <button
        onClick={restore}
        disabled={loading}
        className="flex items-center gap-1 rounded-xl border border-primary/30 px-3 py-1.5 text-xs font-medium text-primary transition hover:bg-primary/10"
      >
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />}
        بازگردانی
      </button>
    </GlassCard>
  );
}

function UserRow({ user, isSelf, viewerIsMainAdmin, onToggle, onDelete }: {
  user: User;
  isSelf: boolean;
  viewerIsMainAdmin: boolean;
  onToggle: () => void;
  onDelete: () => Promise<void>;
}) {
  const entryCount = useEntryCount(user.id);
  const isAdmin = user.role === "ADMIN";
  const mainAdmin = isMainAdmin(user.email);

  let actionButton: React.ReactNode;
  if (mainAdmin) {
    actionButton = <span className="text-[10px] text-muted-foreground" title="نقش مدیر اصلی ثابت است">غیرقابل تغییر</span>;
  } else if (isAdmin) {
    if (viewerIsMainAdmin) {
      actionButton = (
        <button onClick={onToggle} className="rounded-xl border border-rose-500/30 px-3 py-1.5 text-xs font-medium text-rose-600 transition hover:bg-rose-500/10 dark:text-rose-400">
          تنزل به کارمند
        </button>
      );
    } else {
      actionButton = <span className="text-[10px] text-muted-foreground" title="فقط مدیر اصلی می‌تواند تنزل دهد">غیرقابل تنزل</span>;
    }
  } else {
    actionButton = (
      <button onClick={onToggle} className="rounded-xl bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground transition hover:bg-primary/90">
        تبدیل به مدیر
      </button>
    );
  }

  // Delete button — can't delete main admin or yourself.
  const canDelete = !mainAdmin && !isSelf;

  return (
    <GlassCard className="flex items-center justify-between p-4">
      <div className="flex items-center gap-3">
        <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${isAdmin ? "bg-primary/15 text-primary" : "bg-foreground/5 text-foreground/60"}`}>
          {isAdmin ? <ShieldCheck className="h-5 w-5" /> : <Users className="h-5 w-5" />}
        </div>
        <div>
          <p className="text-sm font-semibold">
            {user.name}
            {isSelf && <span className="mr-2 text-[10px] text-primary">(شما)</span>}
          </p>
          <p className="text-[11px] text-muted-foreground" dir="ltr">{user.email}</p>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <div className="hidden text-left sm:block">
          <p className="text-[10px] text-muted-foreground">گزارش‌ها</p>
          <p className="text-sm font-bold tabular-nums">{toPersianDigits(entryCount)}</p>
        </div>
        {mainAdmin ? (
          <span className="rounded-lg bg-primary px-2.5 py-1 text-xs font-bold text-primary-foreground">مدیر اصلی</span>
        ) : isAdmin ? (
          <span className="rounded-lg bg-primary/15 px-2.5 py-1 text-xs font-medium text-primary">مدیر</span>
        ) : (
          <span className="rounded-lg bg-foreground/5 px-2.5 py-1 text-xs font-medium text-foreground/60">کارمند</span>
        )}
        {actionButton}
        {canDelete && (
          <button
            onClick={onDelete}
            className="rounded-xl border border-rose-500/20 p-2 text-rose-500 transition hover:bg-rose-500/10"
            title="حذف کاربر"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        )}
      </div>
    </GlassCard>
  );
}

// ---------- Assign Task tab (admin sends notifications) ----------

function AssignTab({ adminId }: { adminId: string }) {
  const { users: employees } = useEmployees();
  const { users: allUsers } = useAllUsers();
  const { notifications: allNotifs } = useAllNotifications();
  const [userId, setUserId] = useState("");
  const [title, setTitle] = useState("");
  const [details, setDetails] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [sending, setSending] = useState(false);

  // Build a user lookup map so we can show recipient names in the history.
  const userMap = new Map(allUsers.map(u => [u.id, u]));

  const send = async () => {
    if (!userId) { toast.error("کارمند را انتخاب کنید"); return; }
    if (!title.trim()) { toast.error("عنوان وظیفه را بنویسید"); return; }
    if (!details.trim()) { toast.error("جزئیات را بنویسید"); return; }
    setSending(true);
    try {
      const res = await createNotification({ userId, title, details, dueDate: dueDate || undefined });
      if (!res.ok) { toast.error("خطا", { description: res.error }); return; }
      toast.success("وظیفه ارسال شد", { description: "کارمند در صفحه‌ی گزارش خود آن را خواهد دید" });
      setTitle(""); setDetails(""); setDueDate("");
    } finally { setSending(false); }
  };

  return (
    <>
      <div className="mb-5">
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">ارجاع وظیفه</h1>
        <p className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
          <Bell className="h-3.5 w-3.5" /> به کارمند وظیفه‌ای اختصاص دهید — او در صفحه‌ی خود آن را خواهد دید
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Form */}
        <GlassCard className="p-5">
          <h2 className="mb-4 text-sm font-semibold">فرم ارجاع وظیفه جدید</h2>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>کارمند</Label>
              <select value={userId} onChange={e => setUserId(e.target.value)}
                className="h-11 w-full rounded-xl border border-border bg-background/50 px-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/40">
                <option value="">— انتخاب کارمند —</option>
                {employees.map(emp => <option key={emp.id} value={emp.id}>{emp.name} ({emp.email})</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label>عنوان وظیفه</Label>
              <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="مثلاً: آماده‌سازی گزارش فروش" />
            </div>
            <div className="space-y-1.5">
              <Label>جزئیات</Label>
              <Textarea value={details} onChange={e => setDetails(e.target.value)} rows={4} placeholder="شرح کامل وظیفه..." />
            </div>
            <div className="space-y-1.5">
              <Label>مهلت (اختیاری)</Label>
              <Input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} dir="ltr" />
            </div>
            <GlassButton variant="primary" size="lg" disabled={sending} onClick={send} className="w-full">
              {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              ارسال وظیفه
            </GlassButton>
          </div>
        </GlassCard>

        {/* History */}
        <GlassCard className="p-5">
          <h2 className="mb-4 text-sm font-semibold">وظایف ارسال‌شده ({toPersianDigits(allNotifs.length)})</h2>
          {allNotifs.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">هنوز وظیفه‌ای ارسال نشده است.</p>
          ) : (
            <div className="scroll-area max-h-[500px] space-y-2 overflow-y-auto">
              {allNotifs.map(n => {
                const emp = userMap.get(n.userId);
                return (
                  <div key={n.id} className="rounded-xl border border-border/60 bg-background/40 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-medium">{n.title}</p>
                      <span className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] ${n.read ? "bg-emerald-500/15 text-emerald-600" : "bg-amber-500/15 text-amber-600"}`}>
                        {n.read ? "خوانده‌شد" : "جدید"}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">{n.details}</p>
                    <div className="mt-2 flex items-center justify-between text-[10px] text-muted-foreground">
                      <span>گیرنده: {emp?.name ?? "—"}</span>
                      {n.dueDate && <span>مهلت: {n.dueDate}</span>}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </GlassCard>
      </div>
    </>
  );
}

// ---------- Shared UI components ----------

function Topbar({ userName, onLogout }: { userName: string; onLogout: () => void }) {
  return (
    <header className="sticky top-0 z-30 px-4 pt-4">
      <div className="glass glass-border mx-auto flex h-16 max-w-[1400px] items-center justify-between rounded-2xl px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/15 overflow-hidden"><img src="/logo.svg" alt="لوگو" className="h-7 w-7" /></div>
          <div className="leading-tight"><p className="text-sm font-bold tracking-tight">داشبورد مدیر</p><p className="text-[10px] text-muted-foreground">گزارش روزانه</p></div>
        </Link>
        <div className="flex items-center gap-2">
          <Link href="/report"><GlassButton variant="ghost" size="sm" className="gap-1.5"><FileText className="h-4 w-4" /> گزارش من</GlassButton></Link>
          <ThemeToggle />
          <div className="hidden text-left sm:block"><p className="text-xs font-medium">{userName}</p><p className="text-[10px] text-muted-foreground">مدیر سیستم</p></div>
          <GlassButton variant="ghost" size="icon" aria-label="خروج" onClick={onLogout}><LogOut className="h-4 w-4" /></GlassButton>
        </div>
      </div>
    </header>
  );
}

function TabButton({ active, onClick, icon: Icon, label }: {
  active: boolean; onClick: () => void; icon: typeof Calendar; label: string;
}) {
  return (
    <button onClick={onClick}
      className={`flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition ${active ? "bg-primary text-primary-foreground shadow-lg shadow-primary/25" : "glass glass-border text-foreground hover:bg-foreground/5"}`}>
      <Icon className="h-4 w-4" /> {label}
    </button>
  );
}

function StatCard({ icon: Icon, label, value, color }: {
  icon: typeof Users; label: string; value: number; color: string;
}) {
  return (
    <GlassCard className="p-4">
      <div className="flex items-center gap-2 text-xs text-muted-foreground"><Icon className={`h-4 w-4 ${color}`} /> {label}</div>
      <p className="mt-1 text-2xl font-bold tabular-nums">{toPersianDigits(value)}</p>
    </GlassCard>
  );
}

function Loading() {
  return <div className="flex min-h-screen items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
}

function LoginPrompt({ title }: { title: string }) {
  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <GlassCard variant="strong" className="max-w-md p-8 text-center">
        <Lock className="mx-auto mb-3 h-10 w-10 text-primary" />
        <h1 className="text-xl font-bold">{title}</h1>
        <p className="mt-2 text-sm text-muted-foreground">برای ادامه وارد حساب کاربری خود شوید.</p>
        <div className="mt-5 flex justify-center gap-2">
          <Link href="/login"><GlassButton variant="primary" size="lg">ورود</GlassButton></Link>
          <Link href="/"><GlassButton variant="glass" size="lg">خانه</GlassButton></Link>
        </div>
      </GlassCard>
    </div>
  );
}

function AccessDenied({ user }: { user: { name: string; email: string; role: string } }) {
  const { logout } = useAuth();
  const router = useRouter();

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <GlassCard variant="strong" className="max-w-md p-8 text-center">
        <AlertCircle className="mx-auto mb-3 h-10 w-10 text-amber-500" />
        <h1 className="text-xl font-bold">دسترسی محدود</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          این صفحه فقط برای مدیران است.
        </p>
        <div className="mt-4 rounded-xl bg-foreground/5 p-3 text-xs">
          <p className="text-muted-foreground">شما وارد شده‌اید به‌عنوان:</p>
          <p className="mt-1 font-semibold text-foreground">{user.name}</p>
          <p className="text-muted-foreground" dir="ltr">{user.email}</p>
          <p className="mt-1">
            <span className={`rounded px-1.5 py-0.5 font-medium ${user.role === "ADMIN" ? "bg-primary/15 text-primary" : "bg-foreground/5 text-foreground/60"}`}>
              {user.role === "ADMIN" ? "مدیر" : "کارمند"}
            </span>
          </p>
        </div>
        <div className="mt-5 flex flex-wrap justify-center gap-2">
          <Link href="/report"><GlassButton variant="primary" size="lg">گزارش من</GlassButton></Link>
          <GlassButton
            variant="glass"
            size="lg"
            onClick={() => { logout(); router.push("/login"); }}
          >
            <LogOut className="h-4 w-4" /> خروج
          </GlassButton>
          <Link href="/"><GlassButton variant="ghost" size="lg">خانه</GlassButton></Link>
        </div>
      </GlassCard>
    </div>
  );
}

// ---------- Drag-to-scroll ----------

function DragScroll({ children }: { children: React.ReactNode }) {
  const [dragging, setDragging] = useState(false);
  const startX = useRef(0), startScroll = useRef(0), ref = useRef<HTMLDivElement>(null);
  const onDown = (e: React.MouseEvent) => { const el = ref.current; if (!el) return; setDragging(true); startX.current = e.clientX; startScroll.current = el.scrollLeft; };
  const onMove = (e: React.MouseEvent) => { if (!dragging) return; const el = ref.current; if (!el) return; el.scrollLeft = startScroll.current - (e.clientX - startX.current); };
  return (
    <div ref={ref} onMouseDown={onDown} onMouseMove={onMove} onMouseUp={() => setDragging(false)} onMouseLeave={() => setDragging(false)}
      className={`scroll-area ${dragging ? "is-dragging" : "drag-scroll"} glass glass-border overflow-x-auto rounded-2xl`} role="region" aria-label="جدول کشیدنی">
      {children}
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
    // Read-only mode: show values as text, inputs disabled.
    return (
      <div className="space-y-1.5 opacity-60">
        <div className="grid grid-cols-2 gap-1.5">
          <div className="flex flex-col gap-1"><span className="text-[10px] text-muted-foreground">ورود</span>
            <div className="h-8 rounded-md border border-border/50 bg-background/30 px-2 text-xs tabular-nums leading-8">{enterTime || "—"}</div>
          </div>
          <div className="flex flex-col gap-1"><span className="text-[10px] text-muted-foreground">خروج</span>
            <div className="h-8 rounded-md border border-border/50 bg-background/30 px-2 text-xs tabular-nums leading-8">{leaveTime || "—"}</div>
          </div>
        </div>
        <div className="flex w-full flex-col gap-1"><span className="text-[10px] text-muted-foreground">وظیفه</span>
          <div className="min-h-[2rem] rounded-md border border-border/50 bg-background/30 px-2 py-1 text-xs text-muted-foreground">{task || "قفل شده"}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      <div className="grid grid-cols-2 gap-1.5">
        <label className="flex flex-col gap-1"><span className="text-[10px] text-muted-foreground">ورود</span>
          <input type="time" value={enterTime} onChange={e => mark(setEnterTime)(e.target.value)} onBlur={save} dir="ltr" className="h-8 rounded-md border border-border bg-background/60 px-2 text-xs outline-none focus:border-primary focus:ring-1 focus:ring-primary/40" />
        </label>
        <label className="flex flex-col gap-1"><span className="text-[10px] text-muted-foreground">خروج</span>
          <input type="time" value={leaveTime} onChange={e => mark(setLeaveTime)(e.target.value)} onBlur={save} dir="ltr" className="h-8 rounded-md border border-border bg-background/60 px-2 text-xs outline-none focus:border-primary focus:ring-1 focus:ring-primary/40" />
        </label>
      </div>
      <label className="flex w-full flex-col gap-1"><span className="text-[10px] text-muted-foreground">وظیفه</span>
        <textarea value={task} onChange={e => mark(setTask)(e.target.value)} onBlur={save} rows={2} placeholder="شرح..." className="w-full resize-none rounded-md border border-border bg-background/60 px-2 py-1 text-xs outline-none focus:border-primary focus:ring-1 focus:ring-primary/40" />
      </label>
      {saving && <div className="flex items-center gap-1 text-[10px] text-muted-foreground"><Loader2 className="h-3 w-3 animate-spin" /> ذخیره...</div>}
    </div>
  );
}

// ---------- Add employee dialog ----------

function AddEmpDialog({ open, onOpenChange, onAdd }: {
  open: boolean; onOpenChange: (v: boolean) => void;
  onAdd: (input: { name: string; email: string }) => Promise<{ ok: true; user: User } | { ok: false; error: string }>;
}) {
  const [name, setName] = useState(""), [email, setEmail] = useState(""), [loading, setLoading] = useState(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setLoading(true);
    try {
      const res = await onAdd({ name, email });
      if (!res.ok) { toast.error("خطا", { description: res.error }); return; }
      toast.success(`«${res.user.name}» اضافه شد`); setName(""); setEmail(""); onOpenChange(false);
    } finally { setLoading(false); }
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild><GlassButton variant="primary" size="sm" className="gap-1.5"><UserPlus className="h-4 w-4" /> افزودن کارمند</GlassButton></DialogTrigger>
      <DialogContent className="glass-strong glass-border">
        <DialogHeader><DialogTitle>افزودن کارمند</DialogTitle><DialogDescription>کاربر جدید با نقش کارمند ساخته می‌شود.</DialogDescription></DialogHeader>
        <form onSubmit={submit} className="space-y-4 pt-2">
          <div className="space-y-1.5"><Label htmlFor="n">نام</Label><Input id="n" value={name} onChange={e => setName(e.target.value)} required /></div>
          <div className="space-y-1.5"><Label htmlFor="e">ایمیل</Label><Input id="e" type="email" value={email} onChange={e => setEmail(e.target.value)} dir="ltr" required /></div>
          <div className="flex justify-end gap-2 pt-2">
            <GlassButton type="button" variant="ghost" onClick={() => onOpenChange(false)}>انصراف</GlassButton>
            <GlassButton type="submit" variant="primary" disabled={loading}>{loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} افزودن</GlassButton>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ==================== LEAVES ADMIN TAB ====================

function LeavesAdminTab() {
  const { leaves, loading } = useAllLeaves();
  const pending = leaves.filter(l => l.status === "PENDING");
  const resolved = leaves.filter(l => l.status !== "PENDING");

  return (
    <>
      <div className="mb-5">
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">درخواست‌های مرخصی</h1>
        <p className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
          <Palmtree className="h-3.5 w-3.5" /> {pending.length > 0 ? `${toPersianDigits(pending.length)} درخواست در انتظار` : "درخواست جدیدی وجود ندارد"}
        </p>
      </div>

      {loading ? (
        <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
      ) : leaves.length === 0 ? (
        <GlassCard className="p-12 text-center text-muted-foreground">هنوز درخواست مرخصی ثبت نشده است.</GlassCard>
      ) : (
        <div className="space-y-3">
          {pending.length > 0 && (
            <>
              <h2 className="text-sm font-semibold text-amber-600">در انتظار تأیید</h2>
              {pending.map(l => <LeaveRowAdmin key={l.id} leave={l} />)}
            </>
          )}
          {resolved.length > 0 && (
            <>
              <h2 className="mt-6 text-sm font-semibold text-muted-foreground">تاریخچه</h2>
              {resolved.map(l => <LeaveRowAdmin key={l.id} leave={l} />)}
            </>
          )}
        </div>
      )}
    </>
  );
}

function LeaveRowAdmin({ leave }: { leave: LeaveRequest }) {
  const [loading, setLoading] = useState(false);
  const approve = async () => { setLoading(true); try { const r = await resolveLeaveRequest(leave.id, "APPROVE"); if (!r.ok) toast.error(r.error); else toast.success("تأیید شد"); } finally { setLoading(false); } };
  const reject = async () => { setLoading(true); try { const r = await resolveLeaveRequest(leave.id, "REJECT"); if (!r.ok) toast.error(r.error); else toast.success("رد شد"); } finally { setLoading(false); } };

  const statusBadge = leave.status === "APPROVED"
    ? <span className="rounded-lg bg-emerald-500/15 px-2 py-0.5 text-xs font-medium text-emerald-600">تأیید شد</span>
    : leave.status === "REJECTED"
    ? <span className="rounded-lg bg-rose-500/15 px-2 py-0.5 text-xs font-medium text-rose-600">رد شد</span>
    : null;

  return (
    <GlassCard className="p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-semibold">{leave.user?.name || "—"}</p>
          <p className="text-[11px] text-muted-foreground" dir="ltr">{leave.user?.email}</p>
          <p className="mt-2 text-sm"><span className="text-muted-foreground">از </span>{leave.startDate} <span className="text-muted-foreground">تا </span>{leave.endDate}</p>
          <p className="mt-1 text-sm text-muted-foreground">دلیل: {leave.reason}</p>
        </div>
        <div className="flex items-center gap-2">
          {statusBadge}
          {leave.status === "PENDING" && (
            <>
              <button onClick={approve} disabled={loading} className="flex items-center gap-1 rounded-xl bg-emerald-500/15 px-3 py-1.5 text-xs font-medium text-emerald-600 hover:bg-emerald-500/25">
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserCheck className="h-4 w-4" />} تأیید
              </button>
              <button onClick={reject} disabled={loading} className="rounded-xl border border-rose-500/30 px-3 py-1.5 text-xs font-medium text-rose-600 hover:bg-rose-500/10">
                رد
              </button>
            </>
          )}
        </div>
      </div>
    </GlassCard>
  );
}

// ==================== ANNOUNCEMENTS ADMIN TAB ====================

function AnnouncementsAdminTab({ adminId: _adminId }: { adminId: string }) {
  const { announcements } = useAnnouncements();
  const { users } = useAllUsers();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const totalEmployees = users.filter(u => u.role === "EMPLOYEE").length;

  const send = async () => {
    if (!title.trim() || !body.trim()) { toast.error("عنوان و متن الزامی است"); return; }
    setSending(true);
    try {
      const res = await createAnnouncement({ title, body });
      if (!res.ok) { toast.error("خطا", { description: res.error }); return; }
      toast.success("اعلان ارسال شد");
      setTitle(""); setBody("");
    } finally { setSending(false); }
  };

  return (
    <>
      <div className="mb-5">
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">اعلان‌های گروهی</h1>
        <p className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
          <Megaphone className="h-3.5 w-3.5" /> پیام به همه‌ی کارمندان
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <GlassCard className="p-5">
          <h2 className="mb-4 text-sm font-semibold">اعلان جدید</h2>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>عنوان</Label>
              <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="مثلاً: جلسه فردا ساعت ۱۰" />
            </div>
            <div className="space-y-1.5">
              <Label>متن</Label>
              <Textarea value={body} onChange={e => setBody(e.target.value)} rows={5} placeholder="متن اعلان..." />
            </div>
            <GlassButton variant="primary" size="lg" disabled={sending} onClick={send} className="w-full">
              {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Megaphone className="h-4 w-4" />}
              ارسال به همه
            </GlassButton>
          </div>
        </GlassCard>

        <GlassCard className="p-5">
          <h2 className="mb-4 text-sm font-semibold">اعلان‌های ارسال‌شده</h2>
          {announcements.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">هنوز اعلانی ارسال نشده است.</p>
          ) : (
            <div className="scroll-area max-h-[500px] space-y-3 overflow-y-auto">
              {announcements.map(a => (
                <div key={a.id} className="rounded-xl border border-border/60 bg-background/40 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-medium">{a.title}</p>
                    <span className="shrink-0 rounded bg-foreground/5 px-1.5 py-0.5 text-[10px] text-muted-foreground">
                      {toPersianDigits(a.readCount)}/{toPersianDigits(totalEmployees)} خوانده‌اند
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground line-clamp-2">{a.body}</p>
                </div>
              ))}
            </div>
          )}
        </GlassCard>
      </div>
    </>
  );
}

// ==================== MESSAGES TAB ====================

function MessagesTab({ currentUserId, currentUserName: _currentUserName }: { currentUserId: string; currentUserName: string }) {
  const { conversations, loading: convLoading } = useConversations();
  const [selectedPartner, setSelectedPartner] = useState<string | null>(null);
  const { messages, partner, loading: msgLoading } = useConversation(selectedPartner);
  const [newMsg, setNewMsg] = useState("");
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const send = async () => {
    if (!newMsg.trim() || !selectedPartner) return;
    setSending(true);
    try {
      const res = await sendMessage(selectedPartner, newMsg);
      if (!res.ok) { toast.error("خطا", { description: res.error }); return; }
      setNewMsg("");
    } finally { setSending(false); }
  };

  return (
    <>
      <div className="mb-5">
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">پیام‌رسان</h1>
        <p className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
          <MessageSquare className="h-3.5 w-3.5" /> گفتگوی مستقیم با کارمندان
        </p>
      </div>

      <GlassCard className="overflow-hidden p-0">
        <div className="grid h-[600px] grid-cols-1 md:grid-cols-3">
          {/* Sidebar: conversation list */}
          <div className={`border-l border-border/40 ${selectedPartner ? "hidden md:block" : ""}`}>
            <div className="border-b border-border/40 px-4 py-3">
              <h3 className="text-sm font-semibold">گفتگوها</h3>
            </div>
            <div className="scroll-area h-[calc(600px-49px)] overflow-y-auto">
              {convLoading ? (
                <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
              ) : conversations.length === 0 ? (
                <p className="p-4 text-center text-xs text-muted-foreground">کاربری یافت نشد</p>
              ) : (
                conversations.map(c => (
                  <button
                    key={c.id}
                    onClick={() => setSelectedPartner(c.id)}
                    className={`flex w-full flex-col items-start gap-1 border-b border-border/20 p-3 text-right transition hover:bg-foreground/5 ${selectedPartner === c.id ? "bg-primary/10" : ""}`}
                  >
                    <div className="flex w-full items-center justify-between">
                      <span className="text-sm font-medium">{c.name}</span>
                      {c.unreadCount > 0 && (
                        <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-rose-500 px-1.5 text-[10px] font-bold text-white">
                          {toPersianDigits(c.unreadCount)}
                        </span>
                      )}
                    </div>
                    {c.lastMessage && (
                      <span className="line-clamp-1 text-xs text-muted-foreground">{c.lastMessage}</span>
                    )}
                  </button>
                ))
              )}
            </div>
          </div>

          {/* Chat area */}
          <div className={`col-span-2 flex flex-col ${selectedPartner ? "" : "hidden md:flex"}`}>
            {selectedPartner ? (
              <>
                <div className="flex items-center justify-between border-b border-border/40 px-4 py-3">
                  <div className="flex items-center gap-2">
                    <button onClick={() => setSelectedPartner(null)} className="text-muted-foreground hover:text-foreground md:hidden">
                      ←
                    </button>
                    <span className="text-sm font-semibold">{partner?.name || "..."}</span>
                  </div>
                </div>

                <div className="scroll-area flex-1 space-y-2 overflow-y-auto p-4">
                  {msgLoading ? (
                    <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
                  ) : messages.length === 0 ? (
                    <p className="py-8 text-center text-sm text-muted-foreground">شروع گفتگو...</p>
                  ) : (
                    messages.map(m => (
                      <div key={m.id} className={`flex ${m.senderId === currentUserId ? "justify-start" : "justify-end"}`}>
                        <div className={`max-w-[75%] rounded-2xl px-3 py-2 text-sm ${m.senderId === currentUserId ? "bg-primary text-primary-foreground" : "glass glass-border"}`}>
                          {m.body}
                        </div>
                      </div>
                    ))
                  )}
                  <div ref={messagesEndRef} />
                </div>

                <div className="flex items-center gap-2 border-t border-border/40 p-3">
                  <input
                    value={newMsg}
                    onChange={e => setNewMsg(e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter") send(); }}
                    placeholder="پیام بنویسید..."
                    className="h-10 flex-1 rounded-xl border border-border bg-background/50 px-3 text-sm outline-none focus:border-primary"
                  />
                  <button
                    onClick={send}
                    disabled={sending || !newMsg.trim()}
                    className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground transition hover:bg-primary/90 disabled:opacity-50"
                  >
                    {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  </button>
                </div>
              </>
            ) : (
              <div className="flex flex-1 items-center justify-center text-muted-foreground">
                <div className="text-center">
                  <MessageSquare className="mx-auto mb-2 h-8 w-8 opacity-50" />
                  <p className="text-sm">یک گفتگو انتخاب کنید</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </GlassCard>
    </>
  );
}
