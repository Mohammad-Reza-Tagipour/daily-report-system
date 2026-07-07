// lib/useStore.ts — React hooks for reading from the API (backend).
// FIXED: re-fetches on bump(), adds loading/error states, optimizes queries.

import { useEffect, useState, useRef } from "react";

export type User = {
  id: string;
  name: string;
  email: string;
  role: string;
  status?: string;
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
const subscribers = new Set<() => void>();
let version = 0;

function bump() {
  version++;
  subscribers.forEach((fn) => fn());
}

// Hook that re-renders when bump() is called and returns current version.
function useBump(): number {
  const [v, setV] = useState(version);
  useEffect(() => {
    const fn = () => setV(version);
    subscribers.add(fn);
    return () => { subscribers.delete(fn); };
  }, []);
  return v;
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

// ---------- Read hooks (with loading states) ----------

// Generic hook that fetches data, re-fetches on bump(), and tracks loading state.
function useFetch<T>(
  url: string | null,
  deps: unknown[] = []
): { data: T | null; loading: boolean; error: string | null } {
  const ver = useBump(); // re-render on bump
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const reqIdRef = useRef(0);

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (!url) { setData(null); setLoading(false); return; }

    const reqId = ++reqIdRef.current;
    setLoading(true);
    setError(null);

    apiFetch<T>(url)
      .then((d) => {
        if (reqId !== reqIdRef.current) return; // stale request
        setData(d);
        setLoading(false);
      })
      .catch((e) => {
        if (reqId !== reqIdRef.current) return;
        setError((e as Error).message);
        setLoading(false);
      });
  }, [url, ver, ...deps]);
  /* eslint-enable react-hooks/set-state-in-effect */

  return { data, loading, error };
}

// ---------- User hooks ----------

export function useEmployees(): { users: User[]; loading: boolean } {
  const { data, loading } = useFetch<{ users: User[] }>("/api/users?status=APPROVED");
  return { users: (data?.users || []).filter((u) => u.role === "EMPLOYEE"), loading };
}

export function useAllUsers(): { users: User[]; loading: boolean } {
  const { data, loading } = useFetch<{ users: User[] }>("/api/users?status=APPROVED");
  return { users: data?.users || [], loading };
}

export function usePendingUsers(): { users: User[]; loading: boolean } {
  const { data, loading } = useFetch<{ users: User[] }>("/api/users?status=PENDING");
  return { users: data?.users || [], loading };
}

export function useDeletedUsers(): { users: User[]; loading: boolean } {
  const { data, loading } = useFetch<{ users: User[] }>("/api/users?status=DELETED");
  return { users: data?.users || [], loading };
}

// ---------- Entry hooks ----------

export function useMonthEntries(month: string): { entries: ReportEntry[]; loading: boolean } {
  const { data, loading } = useFetch<{ entries: ReportEntry[] }>(`/api/entries?month=${month}&all=true`);
  return { entries: data?.entries || [], loading };
}

export function useUserEntries(userId: string | undefined, month: string): { entries: ReportEntry[]; loading: boolean } {
  const url = userId ? `/api/entries?month=${month}&userId=${userId}` : null;
  const { data, loading } = useFetch<{ entries: ReportEntry[] }>(url);
  return { entries: data?.entries || [], loading };
}

// ---------- Notification hooks ----------

export function useUserNotifications(userId: string | undefined): { notifications: Notification[]; loading: boolean } {
  const url = userId ? "/api/notifications" : null;
  const { data, loading } = useFetch<{ notifications: Notification[] }>(url);
  return { notifications: data?.notifications || [], loading };
}

export function useAllNotifications(): { notifications: Notification[]; loading: boolean } {
  const { data, loading } = useFetch<{ notifications: Notification[] }>("/api/notifications?all=true");
  return { notifications: data?.notifications || [], loading };
}

// ---------- Entry count hook (optimized — uses cached users list) ----------

export function useEntryCount(userId: string): number {
  const { users } = useAllUsers();
  return users.find((x) => x.id === userId)?.entryCount || 0;
}
