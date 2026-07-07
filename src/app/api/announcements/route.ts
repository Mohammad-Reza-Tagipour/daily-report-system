// app/api/announcements/route.ts — Group announcements (اعلان‌های گروهی)
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";

// GET /api/announcements — list announcements (with read status for current user)
export async function GET() {
  const currentUser = await getCurrentUser();
  if (!currentUser) {
    return NextResponse.json({ error: "دسترسی غیرمجاز" }, { status: 403 });
  }

  const announcements = await db.announcement.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      admin: { select: { name: true } },
      reads: {
        where: { userId: currentUser.id },
        select: { id: true },
      },
      _count: { select: { reads: true } },
    },
  });

  // Transform: add `read` boolean and `readCount` for admin
  const enriched = announcements.map((a) => ({
    id: a.id,
    title: a.title,
    body: a.body,
    createdAt: a.createdAt,
    adminName: a.admin.name,
    read: a.reads.length > 0,
    readCount: a._count.reads,
  }));

  return NextResponse.json({ announcements: enriched });
}

// POST /api/announcements — create (admin only)
export async function POST(req: NextRequest) {
  const currentUser = await getCurrentUser();
  if (!currentUser || currentUser.role !== "ADMIN") {
    return NextResponse.json({ error: "دسترسی غیرمجاز" }, { status: 403 });
  }

  try {
    const { title, body } = await req.json();
    if (!title?.trim() || !body?.trim()) {
      return NextResponse.json({ error: "عنوان و متن الزامی است" }, { status: 400 });
    }

    const announcement = await db.announcement.create({
      data: {
        fromAdminId: currentUser.id,
        title: title.trim(),
        body: body.trim(),
      },
    });

    return NextResponse.json({ ok: true, announcement });
  } catch (err) {
    return NextResponse.json({ error: "خطای سرور" }, { status: 500 });
  }
}

// PATCH /api/announcements — mark as read
export async function PATCH(req: NextRequest) {
  const currentUser = await getCurrentUser();
  if (!currentUser) {
    return NextResponse.json({ error: "دسترسی غیرمجاز" }, { status: 403 });
  }

  try {
    const { announcementId } = await req.json();
    if (!announcementId) {
      return NextResponse.json({ error: "شناسه الزامی است" }, { status: 400 });
    }

    // Upsert read record (unique constraint prevents duplicates)
    await db.announcementRead.upsert({
      where: { announcementId_userId: { announcementId, userId: currentUser.id } },
      create: { announcementId, userId: currentUser.id },
      update: {},
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: "خطای سرور" }, { status: 500 });
  }
}
