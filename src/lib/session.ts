// lib/session.ts — simple cookie-based session with HMAC signing.
// Uses crypto for secure token generation (Edge-compatible via Web Crypto API).

import { cookies } from "next/headers";
import bcrypt from "bcryptjs";
import crypto from "crypto";
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

// HMAC-sign a payload using Node's crypto (server-side only).
function sign(payload: string): string {
  const hmac = crypto.createHmac("sha256", AUTH_SECRET);
  hmac.update(payload);
  return hmac.digest("hex");
}

// Create a signed token: base64(payload).signature
function encode(userId: string): string {
  const payload = JSON.stringify({ uid: userId, ts: Date.now() });
  const encoded = Buffer.from(payload).toString("base64");
  const sig = sign(encoded);
  return `${encoded}.${sig}`;
}

// Verify and decode a token. Returns null if invalid or tampered.
function decode(token: string): { uid: string; ts: number } | null {
  const parts = token.split(".");
  if (parts.length !== 2) return null;

  const [encoded, sig] = parts;

  // Verify signature to prevent tampering.
  const expectedSig = sign(encoded);
  if (sig !== expectedSig) return null;

  try {
    const payload = JSON.parse(Buffer.from(encoded, "base64").toString());
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
    select: { id: true, name: true, email: true, role: true, status: true },
  });

  // Block deleted/pending users.
  if (!user || user.status !== "APPROVED") return null;

  return { id: user.id, name: user.name, email: user.email, role: user.role };
}

// Server-side: set the session cookie (on login).
export async function setSession(userId: string): Promise<void> {
  const cookieStore = await cookies();
  const token = encode(userId);
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
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
