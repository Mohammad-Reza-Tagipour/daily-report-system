// lib/session.ts — simple cookie-based session (no NextAuth, no middleware).
// Uses a signed cookie containing the user ID.

import { cookies } from "next/headers";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { MAIN_ADMIN_EMAIL, isMainAdmin } from "@/lib/constants";

export { MAIN_ADMIN_EMAIL, isMainAdmin };

const SESSION_COOKIE = "dprs-session";
const AUTH_SECRET = process.env.AUTH_SECRET || "dev-secret-change-me";

export type SessionUser = {
  id: string;
  name: string;
  email: string;
  role: string;
};

// Simple base64 encode/decode for the session token (not crypto-secure, but
// sufficient for this demo. For production, use JWT or iron-session.)
function encode(userId: string): string {
  const payload = JSON.stringify({ uid: userId, ts: Date.now() });
  return Buffer.from(payload).toString("base64");
}

function decode(token: string): { uid: string; ts: number } | null {
  try {
    const payload = JSON.parse(Buffer.from(token, "base64").toString());
    if (typeof payload.uid !== "string") return null;
    return payload;
  } catch {
    return null;
  }
}

// Server-side: get the current user from the cookie.
export async function getCurrentUser(): Promise<SessionUser | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const decoded = decode(token);
  if (!decoded) return null;

  const user = await db.user.findUnique({
    where: { id: decoded.uid },
    select: { id: true, name: true, email: true, role: true },
  });
  return user;
}

// Server-side: set the session cookie (on login).
export async function setSession(userId: string): Promise<void> {
  const cookieStore = await cookies();
  const token = encode(userId);
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 7, // 7 days
    path: "/",
  });
}

// Server-side: clear the session cookie (on logout).
export async function clearSession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE);
}

// Verify a password against a hash.
export function verifyPassword(password: string, hash: string): boolean {
  return bcrypt.compareSync(password, hash);
}

// Hash a password.
export function hashPassword(password: string): string {
  return bcrypt.hashSync(password, 10);
}
