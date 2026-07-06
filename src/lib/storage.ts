// lib/storage.ts — localStorage data layer (frontend-only, no DB).

export type Role = "ADMIN" | "EMPLOYEE";

export type User = {
  id: string;
  name: string;
  email: string;
  password: string;
  role: Role;
};

export type ReportEntry = {
  id: string;
  userId: string;
  month: string;
  day: number;
  enterTime?: string | null;
  leaveTime?: string | null;
  task?: string | null;
};

export type Notification = {
  id: string;
  userId: string;       // recipient (employee)
  fromAdminId: string;  // sender (admin)
  title: string;
  details: string;
  dueDate?: string | null;
  read: boolean;
  createdAt: number;
};

const USERS_KEY = "dprs.users";
const ENTRIES_KEY = "dprs.entries";
const SESSION_KEY = "dprs.session";
const NOTIFS_KEY = "dprs.notifications";

const DEMO_USERS: User[] = [
  { id: "u-admin", name: "مدیر سیستم", email: "admin@zai.dev", password: "admin123", role: "ADMIN" },
  { id: "u-ali", name: "علی رضایی", email: "ali@zai.dev", password: "ali123", role: "EMPLOYEE" },
  { id: "u-sara", name: "سارا محمدی", email: "sara@zai.dev", password: "sara123", role: "EMPLOYEE" },
  { id: "u-reza", name: "رضا کریمی", email: "reza@zai.dev", password: "reza123", role: "EMPLOYEE" },
];

function read<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) as T : fallback;
  } catch { return fallback; }
}

function write(key: string, value: unknown): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(key, JSON.stringify(value));
}

// ---------- Users ----------

export function getUsers(): User[] {
  const users = read<User[]>(USERS_KEY, []);
  if (users.length === 0) { write(USERS_KEY, DEMO_USERS); return [...DEMO_USERS]; }
  return users;
}

export function getUserById(id: string): User | undefined {
  return getUsers().find(u => u.id === id);
}

export function getUserByEmail(email: string): User | undefined {
  const e = email.trim().toLowerCase();
  return getUsers().find(u => u.email.toLowerCase() === e);
}

export function addUser(input: { name: string; email: string; password?: string; role?: Role }):
  { ok: true; user: User } | { ok: false; error: string } {
  const name = input.name.trim();
  const email = input.email.trim().toLowerCase();
  if (!name) return { ok: false, error: "نام الزامی است" };
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return { ok: false, error: "ایمیل معتبر نیست" };
  const users = getUsers();
  if (users.some(u => u.email.toLowerCase() === email)) return { ok: false, error: "ایمیل تکراری" };
  const user: User = { id: `u-${Date.now()}`, name, email, password: input.password ?? "", role: input.role ?? "EMPLOYEE" };
  users.push(user);
  write(USERS_KEY, users);
  return { ok: true, user };
}

// Toggle a user's role between ADMIN and EMPLOYEE.
// RULES:
// 1. The MAIN ADMIN (admin@zai.dev) can NEVER be changed — by anyone, including themselves.
// 2. Only the MAIN ADMIN can demote other admins back to employee.
//    Regular admins cannot demote anyone — they can only promote employees.
export const MAIN_ADMIN_EMAIL = "admin@zai.dev";

export function isMainAdmin(user: { email: string }): boolean {
  return user.email.trim().toLowerCase() === MAIN_ADMIN_EMAIL;
}

export function toggleUserRole(userId: string, currentUserId?: string): { ok: true; user: User } | { ok: false; error: string } {
  const users = getUsers();
  const idx = users.findIndex(u => u.id === userId);
  if (idx < 0) return { ok: false, error: "کاربر یافت نشد" };

  const target = users[idx];
  const isCurrentlyAdmin = target.role === "ADMIN";

  // Rule 1: main admin can never be changed — by anyone.
  if (isMainAdmin(target)) {
    return { ok: false, error: "نقش مدیر اصلی قابل تغییر نیست" };
  }

  // Determine who is performing the action.
  const actor = currentUserId ? users.find(u => u.id === currentUserId) : undefined;
  const actorIsMainAdmin = actor ? isMainAdmin(actor) : false;

  // Rule 2a: if demoting an admin, only the main admin can do it.
  if (isCurrentlyAdmin && !actorIsMainAdmin) {
    return { ok: false, error: "فقط مدیر اصلی می‌تواند مدیران را تنزل دهد" };
  }

  // Rule 2b: main admin can't demote themselves (they are the main admin, already
  // blocked by Rule 1). But they CAN demote other admins.

  // Perform the toggle.
  users[idx].role = isCurrentlyAdmin ? "EMPLOYEE" : "ADMIN";
  write(USERS_KEY, users);
  return { ok: true, user: users[idx] };
}

// ---------- Session ----------

export function getSessionUserId(): string | null {
  return read<string | null>(SESSION_KEY, null);
}

export function getCurrentUser(): User | null {
  const id = getSessionUserId();
  if (!id) return null;
  return getUserById(id) ?? null;
}

export function setSession(userId: string | null): void {
  if (typeof window === "undefined") return;
  if (userId === null) localStorage.removeItem(SESSION_KEY);
  else write(SESSION_KEY, userId);
}

export function loginWithCredentials(email: string, password: string):
  { ok: true; user: User } | { ok: false; error: string } {
  const user = getUserByEmail(email);
  if (!user || user.password !== password) return { ok: false, error: "ایمیل یا گذرواژه اشتباه" };
  setSession(user.id);
  return { ok: true, user };
}

export function logout(): void { setSession(null); }

// ---------- Report Entries ----------

export function getEntries(month: string): ReportEntry[] {
  return read<ReportEntry[]>(ENTRIES_KEY, []).filter(e => e.month === month);
}

export function getEntriesForUser(userId: string, month: string): ReportEntry[] {
  return getEntries(month).filter(e => e.userId === userId);
}

export function getEntryCountForUser(userId: string): number {
  return read<ReportEntry[]>(ENTRIES_KEY, []).filter(e => e.userId === userId).length;
}

export function upsertEntry(input: {
  userId: string; month: string; day: number;
  enterTime?: string | null; leaveTime?: string | null; task?: string | null;
}): ReportEntry | null {
  const all = read<ReportEntry[]>(ENTRIES_KEY, []);
  const idx = all.findIndex(e => e.userId === input.userId && e.month === input.month && e.day === input.day);

  const enterTime = input.enterTime?.trim() || null;
  const leaveTime = input.leaveTime?.trim() || null;
  const task = input.task?.trim() || null;

  // If ALL fields are empty, DELETE the entry entirely (so it doesn't count
  // toward the completion percentage).
  if (!enterTime && !leaveTime && !task) {
    if (idx >= 0) {
      all.splice(idx, 1);
      write(ENTRIES_KEY, all);
    }
    return null;
  }

  let entry: ReportEntry;
  if (idx >= 0) {
    entry = { ...all[idx], enterTime, leaveTime, task };
    all[idx] = entry;
  } else {
    entry = { id: `e-${Date.now()}`, userId: input.userId, month: input.month, day: input.day, enterTime, leaveTime, task };
    all.push(entry);
  }
  write(ENTRIES_KEY, all);
  return entry;
}

export function seedSampleEntriesIfEmpty(month: string): void {
  if (typeof window === "undefined") return;
  const existing = read<ReportEntry[]>(ENTRIES_KEY, []);
  if (existing.length > 0) return;
  const users = getUsers().filter(u => u.role === "EMPLOYEE");
  const tasks = ["توسعه‌ی ویژگی", "بازبینی کد", "جلسه با مشتری", "اصلاح باگ", "پیاده‌سازی تقویم"];
  const samples: ReportEntry[] = [];
  for (let day = 1; day <= 10; day++) {
    for (const u of users) {
      samples.push({ id: `e-seed-${u.id}-${day}`, userId: u.id, month, day, enterTime: `09:0${(day % 9) + 1}`, leaveTime: `17:${30 + (day % 30)}`, task: tasks[day % tasks.length] });
    }
  }
  write(ENTRIES_KEY, samples);
}

// ---------- Notifications (admin assigns tasks to employees) ----------

export function getNotificationsForUser(userId: string): Notification[] {
  return read<Notification[]>(NOTIFS_KEY, []).filter(n => n.userId === userId).sort((a, b) => b.createdAt - a.createdAt);
}

export function getAllNotifications(): Notification[] {
  return read<Notification[]>(NOTIFS_KEY, []).sort((a, b) => b.createdAt - a.createdAt);
}

export function createNotification(input: {
  userId: string; fromAdminId: string; title: string; details: string; dueDate?: string;
}): Notification {
  const all = read<Notification[]>(NOTIFS_KEY, []);
  const notif: Notification = {
    id: `n-${Date.now()}`,
    userId: input.userId,
    fromAdminId: input.fromAdminId,
    title: input.title.trim(),
    details: input.details.trim(),
    dueDate: input.dueDate || null,
    read: false,
    createdAt: Date.now(),
  };
  all.push(notif);
  write(NOTIFS_KEY, all);
  return notif;
}

export function markNotificationRead(notifId: string): void {
  const all = read<Notification[]>(NOTIFS_KEY, []);
  const idx = all.findIndex(n => n.id === notifId);
  if (idx >= 0) { all[idx].read = true; write(NOTIFS_KEY, all); }
}
