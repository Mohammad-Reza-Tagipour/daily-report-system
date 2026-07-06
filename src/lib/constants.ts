// lib/constants.ts — shared constants (safe for both client and server).

export const MAIN_ADMIN_EMAIL = "admin@zai.dev";

export function isMainAdmin(email: string): boolean {
  return email.trim().toLowerCase() === MAIN_ADMIN_EMAIL;
}
