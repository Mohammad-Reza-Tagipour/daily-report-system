"use client";

// context/AuthContext.tsx — client-side auth backed by API + cookie session.
// No localStorage, no NextAuth. Simple fetch calls to /api/auth/*.

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";

type User = {
  id: string;
  name: string;
  email: string;
  role: string;
};

type AuthValue = {
  user: User | null;
  ready: boolean;
  login: (email: string, password: string) => Promise<{ ok: true; user: User } | { ok: false; error: string }>;
  signup: (input: { name: string; email: string; password: string }) => Promise<{ ok: true; user: User } | { ok: false; error: string }>;
  addEmployee: (input: { name: string; email: string }) => Promise<{ ok: true; user: User } | { ok: false; error: string }>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
};

const AuthContext = createContext<AuthValue | undefined>(undefined);

const SESSION_TIMEOUT_MS = 15 * 60 * 1000; // 15 minutes

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    // Load current user from the API (cookie-based session).
    let cancelled = false;
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled) {
          setUser(data.user || null);
          setReady(true);
        }
      })
      .catch(() => {
        if (!cancelled) setReady(true);
      });

    // ---- 15-minute session timeout ----
    const resetTimer = () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(async () => {
        await fetch("/api/auth/logout", { method: "POST" });
        setUser(null);
      }, SESSION_TIMEOUT_MS);
    };

    const events = ["mousedown", "keydown", "touchstart", "click", "scroll"];
    events.forEach((e) => window.addEventListener(e, resetTimer, { passive: true }));
    resetTimer();

    return () => {
      cancelled = true;
      events.forEach((e) => window.removeEventListener(e, resetTimer));
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json();
    if (!res.ok || !data.ok) {
      return { ok: false as const, error: data.error || "خطا" };
    }
    setUser(data.user);
    return { ok: true as const, user: data.user };
  }, []);

  const signup = useCallback(async (input: { name: string; email: string; password: string }) => {
    const res = await fetch("/api/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    const data = await res.json();
    if (!res.ok || !data.ok) {
      return { ok: false as const, error: data.error || "خطا" };
    }
    setUser(data.user);
    return { ok: true as const, user: data.user };
  }, []);

  const addEmployee = useCallback(async (input: { name: string; email: string }) => {
    const res = await fetch("/api/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    const data = await res.json();
    if (!res.ok || !data.ok) {
      return { ok: false as const, error: data.error || "خطا" };
    }
    return { ok: true as const, user: data.user };
  }, []);

  const logout = useCallback(async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    setUser(null);
  }, []);

  const refreshUser = useCallback(async () => {
    const res = await fetch("/api/auth/me");
    const data = await res.json();
    setUser(data.user || null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, ready, login, signup, addEmployee, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
