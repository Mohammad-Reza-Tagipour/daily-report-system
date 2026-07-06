// lib/useStore.ts — React hooks for reading from the API (backend).
// Uses fetch + simple state with periodic refresh.

import { useCallback, useEffect, useState } from "react";

export type User = {
  id: string;
  name: string;
  email: string;
  role: string;
  entryCount?: number;
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
  userId: string;
  fromAdminId: string;
  title: string;
  details: string;
  dueDate?: string | null;
  read: boolean;
  createdAt: string;
  recipient?: { name: string; email: string };
  sender?: { name: string };
};

// ---------- Global refresh mechanism ----------
// Any write call bumps the version, which triggers all hooks to re-fetch.

const subscribers = new Set<() => void>();
let version = 0;

function bump() {
  version++;
  subscribers.forEach((fn) => fn());
}

// Hook that re-renders when bump() is called.
function useBump() {
  const [, setV] = useState(0);
  useEffect(() => {
    const fn = () => setV((v) => v + 1);
    subscribers.add(fn);
    return () => { subscribers.delete(fn); };
  }, []);
  return version;
}

// ---------- Fetch helper ----------

async function apiFetch<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, options);
  const data = await res.json();
  if (!res.ok) throw new Error((data as { error?: string }).error || "خطا");
  return data as T;
}

// ---------- Write API ----------

export async function upsertEntry(input: {
  userId: string; month: string; day: number;
  enterTime?: string | null; leaveTime?: string | null; task?: string | null;
}): Promise<void> {
  await apiFetch("/api/entries", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  bump();
}

export async function addUser(input: { name: string; email: string }): Promise<{ ok: true; user: User } | { ok: false; error: string }> {
  try {
    const data = await apiFetch<{ ok: boolean; user: User }>("/api/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    bump();
    return { ok: true, user: data.user };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export async function toggleUserRole(userId: string): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    await apiFetch("/api/users", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId }),
    });
    bump();
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export async function approveUser(userId: string): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    await apiFetch("/api/users", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, action: "APPROVE" }),
    });
    bump();
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export async function restoreUser(userId: string): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    await apiFetch("/api/users", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, action: "RESTORE" }),
    });
    bump();
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export async function deleteUser(userId: string): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    await apiFetch("/api/users", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId }),
    });
    bump();
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export async function createNotification(input: {
  userId: string; title: string; details: string; dueDate?: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    await apiFetch("/api/notifications", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    bump();
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export async function markNotificationRead(notifId: string): Promise<void> {
  await apiFetch("/api/notifications", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ notificationId: notifId }),
  });
  bump();
}

// ---------- Read hooks ----------

/* eslint-disable react-hooks/set-state-in-effect */

// Fetch + cache pattern: each hook fetches on mount and when version changes.
function useApiFetch<T>(url: string | null): T[] | null {
  useBump();
  const [data, setData] = useState<T[] | null>(null);

  useEffect(() => {
    if (!url) { setData([]); return; }
    let cancelled = false;
    apiFetch<{ entries?: T[]; users?: T[]; notifications?: T[] }>(url)
      .then((d) => {
        if (cancelled) return;
        const arr = d.entries || d.users || d.notifications || [];
        setData(arr);
      })
      .catch(() => { if (!cancelled) setData([]); });
    return () => { cancelled = true; };
  }, [url]);

  return data;
}

export function useEmployees(): User[] {
  const users = useApiFetch<User>("/api/users");
  return (users || []).filter((u) => u.role === "EMPLOYEE");
}

export function useAllUsers(): User[] {
  const users = useApiFetch<User>("/api/users?status=APPROVED");
  return users || [];
}

export function usePendingUsers(): User[] {
  const users = useApiFetch<User>("/api/users?status=PENDING");
  return users || [];
}

export function useDeletedUsers(): User[] {
  const users = useApiFetch<User>("/api/users?status=DELETED");
  return users || [];
}

export function useMonthEntries(month: string): ReportEntry[] {
  // Admin sees all entries for the month (we fetch per-employee and merge).
  // For simplicity, fetch all users' entries via a special endpoint.
  const [entries, setEntries] = useState<ReportEntry[]>([]);
  useBump();

  useEffect(() => {
    let cancelled = false;
    apiFetch<{ entries: ReportEntry[] }>(`/api/entries?month=${month}&all=true`)
      .then((d) => { if (!cancelled) setEntries(d.entries); })
      .catch(() => { if (!cancelled) setEntries([]); });
    return () => { cancelled = true; };
  }, [month]);

  return entries;
}

export function useUserEntries(userId: string | undefined, month: string): ReportEntry[] {
  const [entries, setEntries] = useState<ReportEntry[]>([]);
  useBump();

  useEffect(() => {
    if (!userId) { setEntries([]); return; }
    let cancelled = false;
    apiFetch<{ entries: ReportEntry[] }>(`/api/entries?month=${month}&userId=${userId}`)
      .then((d) => { if (!cancelled) setEntries(d.entries); })
      .catch(() => { if (!cancelled) setEntries([]); });
    return () => { cancelled = true; };
  }, [userId, month]);

  return entries;
}

export function useUserNotifications(userId: string | undefined): Notification[] {
  const [notifs, setNotifs] = useState<Notification[]>([]);
  useBump();

  useEffect(() => {
    if (!userId) { setNotifs([]); return; }
    let cancelled = false;
    apiFetch<{ notifications: Notification[] }>("/api/notifications")
      .then((d) => { if (!cancelled) setNotifs(d.notifications); })
      .catch(() => { if (!cancelled) setNotifs([]); });
    return () => { cancelled = true; };
  }, [userId]);

  return notifs;
}

export function useAllNotifications(): Notification[] {
  const [notifs, setNotifs] = useState<Notification[]>([]);
  useBump();

  useEffect(() => {
    let cancelled = false;
    apiFetch<{ notifications: Notification[] }>("/api/notifications?all=true")
      .then((d) => { if (!cancelled) setNotifs(d.notifications); })
      .catch(() => { if (!cancelled) setNotifs([]); });
    return () => { cancelled = true; };
  }, []);

  return notifs;
}

export function useEntryCount(userId: string): number {
  const users = useApiFetch<User>("/api/users");
  const u = (users || []).find((x) => x.id === userId);
  return u?.entryCount || 0;
}
