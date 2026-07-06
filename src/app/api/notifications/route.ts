// app/api/notifications/route.ts — GET notifications, POST create
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";

// GET /api/notifications — current user's notifications (or all for admin)
export async function GET(req: NextRequest) {
  const currentUser = await getCurrentUser();
  if (!currentUser) {
    return NextResponse.json({ error: "دسترسی غیرمجاز" }, { status: 403 });
  }

  const url = new URL(req.url);
  const all = url.searchParams.get("all") === "true";

  // Admin can request all notifications.
  if (all && currentUser.role === "ADMIN") {
    const notifications = await db.notification.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        recipient: { select: { name: true, email: true } },
        sender: { select: { name: true } },
      },
    });
    return NextResponse.json({ notifications });
  }

  // Regular user: only their notifications.
  const notifications = await db.notification.findMany({
    where: { userId: currentUser.id },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ notifications });
}

// POST /api/notifications — create a notification (admin only)
export async function POST(req: NextRequest) {
  const currentUser = await getCurrentUser();
  if (!currentUser || currentUser.role !== "ADMIN") {
    return NextResponse.json({ error: "دسترسی غیرمجاز" }, { status: 403 });
  }

  try {
    const { userId, title, details, dueDate } = await req.json();
    if (!userId || !title?.trim() || !details?.trim()) {
      return NextResponse.json({ error: "کارمند، عنوان و جزئیات الزامی است" }, { status: 400 });
    }

    const target = await db.user.findUnique({ where: { id: userId } });
    if (!target) {
      return NextResponse.json({ error: "کاربر یافت نشد" }, { status: 404 });
    }

    const notification = await db.notification.create({
      data: {
        userId,
        fromAdminId: currentUser.id,
        title: title.trim(),
        details: details.trim(),
        dueDate: dueDate || null,
      },
    });

    return NextResponse.json({ ok: true, notification });
  } catch (err) {
    return NextResponse.json({ error: "خطای سرور" }, { status: 500 });
  }
}

// PATCH /api/notifications — mark as read
export async function PATCH(req: NextRequest) {
  const currentUser = await getCurrentUser();
  if (!currentUser) {
    return NextResponse.json({ error: "دسترسی غیرمجاز" }, { status: 403 });
  }

  try {
    const { notificationId } = await req.json();
    if (!notificationId) {
      return NextResponse.json({ error: "شناسه اعلان الزامی است" }, { status: 400 });
    }

    // Verify the notification belongs to the current user.
    const notif = await db.notification.findUnique({ where: { id: notificationId } });
    if (!notif) {
      return NextResponse.json({ error: "اعلان یافت نشد" }, { status: 404 });
    }
    if (notif.userId !== currentUser.id && currentUser.role !== "ADMIN") {
      return NextResponse.json({ error: "دسترسی غیرمجاز" }, { status: 403 });
    }

    await db.notification.update({
      where: { id: notificationId },
      data: { read: true },
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: "خطای سرور" }, { status: 500 });
  }
}
