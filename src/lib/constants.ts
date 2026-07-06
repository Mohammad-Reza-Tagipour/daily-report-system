// lib/constants.ts — shared constants (safe for both client and server).

export const MAIN_ADMIN_EMAIL = "admin@zai.dev";

export function isMainAdmin(email: string | null | undefined): boolean {
  if (!email || typeof email !== "string") return false;
  return email.trim().toLowerCase() === MAIN_ADMIN_EMAIL;
}

export const CREATOR_NAME = "Mohammad Reza Tagipour";
