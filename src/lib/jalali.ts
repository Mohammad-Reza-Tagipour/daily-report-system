// lib/jalali.ts
// Jalali (Persian Solar Hijri) date helpers.
// Conversions are backed by the well-tested `jalaali-js` library; all
// formatting (Persian digits, month/weekday names, relative time) is done
// locally so we keep full control over the output.

import { toJalaali, toGregorian, jalaaliMonthLength, isLeapJalaaliYear } from "jalaali-js";

export type JalaliDate = {
  jy: number; // Jalali year (e.g. 1405)
  jm: number; // 1..12
  jd: number; // 1..31
};

const PERSIAN_MONTHS = [
  "فروردین", "اردیبهشت", "خرداد",
  "تیر", "مرداد", "شهریور",
  "مهر", "آبان", "آذر",
  "دی", "بهمن", "اسفند",
];

// JS getDay() returns 0=Sunday..6=Saturday.
// Persian week starts on Saturday; for display we re-order starting Saturday.
const PERSIAN_WEEKDAYS = [
  "یکشنبه", "دوشنبه", "سه‌شنبه",
  "چهارشنبه", "پنجشنبه", "جمعه", "شنبه",
];

// ---------- Conversions (backed by jalaali-js) ----------

export function gregorianToJalali(gy: number, gm: number, gd: number): JalaliDate {
  const r = toJalaali(gy, gm, gd);
  return { jy: r.jy, jm: r.jm, jd: r.jd };
}

export function jalaliToGregorian(jy: number, jm: number, jd: number): [number, number, number] {
  const r = toGregorian(jy, jm, jd);
  return [r.gy, r.gm, r.gd];
}

export function toJalali(date: Date): JalaliDate {
  return gregorianToJalali(date.getFullYear(), date.getMonth() + 1, date.getDate());
}

export function jalaliToDate(jy: number, jm: number, jd: number): Date {
  const [gy, gm, gd] = jalaliToGregorian(jy, jm, jd);
  return new Date(gy, gm - 1, gd);
}

// ---------- Formatting ----------

// Convert Latin digits in a string to Persian digits (۰-۹).
export function toPersianDigits(input: string | number): string {
  const persianDigits = ["۰", "۱", "۲", "۳", "۴", "۵", "۶", "۷", "۸", "۹"];
  return String(input).replace(/[0-9]/g, (d) => persianDigits[+d]);
}

// Format a Date as a Jalali string, e.g. "۱۴ تیر ۱۴۰۵".
export function formatJalali(date: Date, opts?: { withWeekday?: boolean; withTime?: boolean }): string {
  const j = toJalali(date);
  const month = PERSIAN_MONTHS[j.jm - 1];
  const day = toPersianDigits(j.jd);
  const year = toPersianDigits(j.jy);
  const weekday = opts?.withWeekday ? `${PERSIAN_WEEKDAYS[date.getDay()]} ` : "";
  const time = opts?.withTime
    ? ` - ${toPersianDigits(date.getHours().toString().padStart(2, "0"))}:${toPersianDigits(date.getMinutes().toString().padStart(2, "0"))}`
    : "";
  return `${weekday}${day} ${month} ${year}${time}`;
}

// Format a Jalali date as a short numeric string: "1405/04/14".
export function formatJalaliShort(date: Date): string {
  const j = toJalali(date);
  return toPersianDigits(`${j.jy}/${String(j.jm).padStart(2, "0")}/${String(j.jd).padStart(2, "0")}`);
}

// Get the Persian month name by index (1..12).
export function persianMonthName(month: number): string {
  return PERSIAN_MONTHS[month - 1] ?? "";
}

// Get all Persian month names (1..12).
export function persianMonths(): string[] {
  return [...PERSIAN_MONTHS];
}

// Get all Persian weekday names (Sat..Fri re-ordered for RTL display, starting Saturday).
export function persianWeekdays(): string[] {
  return ["شنبه", "یکشنبه", "دوشنبه", "سه‌شنبه", "چهارشنبه", "پنجشنبه", "جمعه"];
}

// Number of days in a given Jalali month (29/30 for Esfand depending on leap year).
export function jalaliMonthLength(jy: number, jm: number): number {
  return jalaaliMonthLength(jy, jm);
}

// Is the given Jalali year a leap year?
export function isJalaliLeapYear(jy: number): boolean {
  return isLeapJalaaliYear(jy);
}

// Relative-time formatter that returns Persian strings (e.g. "۳ ساعت پیش").
export function relativeTimeJalali(date: Date): string {
  const diffMs = Date.now() - date.getTime();
  const sec = Math.floor(diffMs / 1000);
  const min = Math.floor(sec / 60);
  const hr = Math.floor(min / 60);
  const day = Math.floor(hr / 24);
  if (sec < 60) return "لحظاتی پیش";
  if (min < 60) return `${toPersianDigits(min)} دقیقه پیش`;
  if (hr < 24) return `${toPersianDigits(hr)} ساعت پیش`;
  if (day < 30) return `${toPersianDigits(day)} روز پیش`;
  return formatJalaliShort(date);
}

// ---------- Month-key helpers (format: "1405-04") ----------
// Used as the `month` field on ReportEntry so we can query a single Jalali
// month with a single string comparison.

export type JalaliMonthKey = string;

export function toMonthKey(jy: number, jm: number): JalaliMonthKey {
  return `${jy}-${String(jm).padStart(2, "0")}`;
}

export function currentMonthKey(date: Date = new Date()): JalaliMonthKey {
  const j = toJalali(date);
  return toMonthKey(j.jy, j.jm);
}

export function parseMonthKey(key: JalaliMonthKey): { jy: number; jm: number } {
  const [jyStr, jmStr] = key.split("-");
  return { jy: Number(jyStr), jm: Number(jmStr) };
}

// Shift a month key by `delta` months (can be negative). Wraps across years.
export function shiftMonthKey(key: JalaliMonthKey, delta: number): JalaliMonthKey {
  const { jy, jm } = parseMonthKey(key);
  let total = jy * 12 + (jm - 1) + delta;
  const newJy = Math.floor(total / 12);
  const newJm = (total % 12) + 1;
  return toMonthKey(newJy, newJm);
}

// Return JS getDay() (0=Sun..6=Sat) for a given Jalali day.
export function weekdayOfJalaliDay(jy: number, jm: number, jd: number): number {
  return jalaliToDate(jy, jm, jd).getDay();
}

// Persian weekday name for a given Jalali day.
export function persianWeekdayOfJalaliDay(jy: number, jm: number, jd: number): string {
  const d = weekdayOfJalaliDay(jy, jm, jd);
  return PERSIAN_WEEKDAYS[d];
}

// Build the list of days (1..N) for a given Jalali month key.
export function daysOfMonth(key: JalaliMonthKey): number[] {
  const { jy, jm } = parseMonthKey(key);
  const n = jalaliMonthLength(jy, jm);
  return Array.from({ length: n }, (_, i) => i + 1);
}

// Is a given Jalali day a Friday (the Persian weekend)?
// JS getDay(): 0=Sunday, ..., 5=Friday, 6=Saturday.
export function isFriday(jy: number, jm: number, jd: number): boolean {
  return weekdayOfJalaliDay(jy, jm, jd) === 5;
}

// ---------- Today / past / future helpers ----------

// Returns the Jalali day number for "today" (1..31) in the current month.
export function todayJalaliDay(): number {
  return toJalali(new Date()).jd;
}

// Returns the current Jalali month key (e.g. "1405-04").
export function todayMonthKey(): JalaliMonthKey {
  return currentMonthKey(new Date());
}

// Is the given Jalali date today?
export function isToday(jy: number, jm: number, jd: number): boolean {
  const now = toJalali(new Date());
  return jy === now.jy && jm === now.jm && jd === now.jd;
}

// Is the given Jalali date in the past (before today)?
// Returns false for today itself (today is editable).
export function isPastDay(jy: number, jm: number, jd: number): boolean {
  const now = toJalali(new Date());
  const given = jy * 10000 + jm * 100 + jd;
  const current = now.jy * 10000 + now.jm * 100 + now.jd;
  return given < current;
}

// Is the given Jalali date in the future (after today)?
export function isFutureDay(jy: number, jm: number, jd: number): boolean {
  const now = toJalali(new Date());
  const given = jy * 10000 + jm * 100 + jd;
  const current = now.jy * 10000 + now.jm * 100 + now.jd;
  return given > current;
}

// Can the user edit this day? (today or any past day)
export function canEditDay(jy: number, jm: number, jd: number): boolean {
  return !isFutureDay(jy, jm, jd);
}
