// app/api/entries/route.ts — GET entries for a month, POST upsert entry
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";

// GET /api/entries?month=1405-04&userId=xxx&all=true
// - If all=true and user is admin, returns all entries for the month.
// - If userId is provided, returns that user's entries (admin only for other users).
// - If no userId, returns the current user's entries.
export async function GET(req: NextRequest) {
  const currentUser = await getCurrentUser();
  if (!currentUser) {
    return NextResponse.json({ error: "دسترسی غیرمجاز" }, { status: 403 });
  }

  const url = new URL(req.url);
  const month = url.searchParams.get("month");
  const userId = url.searchParams.get("userId");
  const all = url.searchParams.get("all") === "true";

  if (!month || !/^\d{4}-\d{2}$/.test(month)) {
    return NextResponse.json({ error: "ماه نامعتبر" }, { status: 400 });
  }

  // Admin requesting all entries for the month.
  if (all && currentUser.role === "ADMIN") {
    const entries = await db.reportEntry.findMany({
      where: { month },
      orderBy: { day: "asc" },
    });
    return NextResponse.json({ entries });
  }

  // If requesting another user's entries, must be admin.
  const targetUserId = userId || currentUser.id;
  if (userId && userId !== currentUser.id && currentUser.role !== "ADMIN") {
    return NextResponse.json({ error: "دسترسی غیرمجاز" }, { status: 403 });
  }

  const entries = await db.reportEntry.findMany({
    where: { month, userId: targetUserId },
    orderBy: { day: "asc" },
  });

  return NextResponse.json({ entries });
}

// POST /api/entries — upsert (create or update) an entry
export async function POST(req: NextRequest) {
  const currentUser = await getCurrentUser();
  if (!currentUser) {
    return NextResponse.json({ error: "دسترسی غیرمجاز" }, { status: 403 });
  }

  try {
    const { userId, month, day, enterTime, leaveTime, task } = await req.json();

    // Validate.
    if (!userId || !month || typeof day !== "number") {
      return NextResponse.json({ error: "پارامترهای نامعتبر" }, { status: 400 });
    }

    // Only the user themselves or an admin can edit.
    if (userId !== currentUser.id && currentUser.role !== "ADMIN") {
      return NextResponse.json({ error: "اجازه ویرایش ندارید" }, { status: 403 });
    }

    const enterTimeVal = enterTime?.trim() || null;
    const leaveTimeVal = leaveTime?.trim() || null;
    const taskVal = task?.trim() || null;

    // If all fields empty, delete the entry.
    if (!enterTimeVal && !leaveTimeVal && !taskVal) {
      await db.reportEntry.deleteMany({
        where: { userId, month, day },
      });
      return NextResponse.json({ ok: true, deleted: true });
    }

    const entry = await db.reportEntry.upsert({
      where: { userId_month_day: { userId, month, day } },
      create: { userId, month, day, enterTime: enterTimeVal, leaveTime: leaveTimeVal, task: taskVal },
      update: { enterTime: enterTimeVal, leaveTime: leaveTimeVal, task: taskVal },
    });

    return NextResponse.json({ ok: true, entry });
  } catch (err) {
    return NextResponse.json({ error: "خطای سرور" }, { status: 500 });
  }
}
