// app/api/messages/route.ts — Direct messages (پیام‌رسان)
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";

// GET /api/messages?with=userId — conversation history
// GET /api/messages?conversations=true — list of conversation partners
export async function GET(req: NextRequest) {
  const currentUser = await getCurrentUser();
  if (!currentUser) {
    return NextResponse.json({ error: "دسترسی غیرمجاز" }, { status: 403 });
  }

  const url = new URL(req.url);
  const conversationsMode = url.searchParams.get("conversations") === "true";
  const partnerId = url.searchParams.get("with");

  // List of conversation partners with last message + unread count
  if (conversationsMode) {
    // Admin: all employees. Employee: just the admin(s).
    let partners: { id: string; name: string; email: string; role: string }[];

    if (currentUser.role === "ADMIN") {
      partners = await db.user.findMany({
        where: { role: "EMPLOYEE", status: "APPROVED" },
        select: { id: true, name: true, email: true, role: true },
        orderBy: { name: "asc" },
      });
    } else {
      partners = await db.user.findMany({
        where: { role: "ADMIN", status: "APPROVED" },
        select: { id: true, name: true, email: true, role: true },
      });
    }

    // For each partner, get last message + unread count
    const enriched = await Promise.all(
      partners.map(async (p) => {
        const lastMsg = await db.directMessage.findFirst({
          where: {
            OR: [
              { senderId: currentUser.id, recipientId: p.id },
              { senderId: p.id, recipientId: currentUser.id },
            ],
          },
          orderBy: { createdAt: "desc" },
          select: { body: true, createdAt: true, senderId: true },
        });

        const unreadCount = await db.directMessage.count({
          where: { senderId: p.id, recipientId: currentUser.id, read: false },
        });

        return {
          ...p,
          lastMessage: lastMsg?.body || null,
          lastMessageTime: lastMsg?.createdAt || null,
          unreadCount,
        };
      })
    );

    // Sort by last message time (most recent first), partners with no messages at the end
    enriched.sort((a, b) => {
      if (!a.lastMessageTime && !b.lastMessageTime) return 0;
      if (!a.lastMessageTime) return 1;
      if (!b.lastMessageTime) return -1;
      return new Date(b.lastMessageTime).getTime() - new Date(a.lastMessageTime).getTime();
    });

    return NextResponse.json({ conversations: enriched });
  }

  // Get conversation with a specific user
  if (partnerId) {
    const messages = await db.directMessage.findMany({
      where: {
        OR: [
          { senderId: currentUser.id, recipientId: partnerId },
          { senderId: partnerId, recipientId: currentUser.id },
        ],
      },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        senderId: true,
        recipientId: true,
        body: true,
        read: true,
        createdAt: true,
      },
    });

    // Mark received messages as read
    await db.directMessage.updateMany({
      where: { senderId: partnerId, recipientId: currentUser.id, read: false },
      data: { read: true },
    });

    const partner = await db.user.findUnique({
      where: { id: partnerId },
      select: { id: true, name: true, email: true },
    });

    return NextResponse.json({ messages, partner });
  }

  return NextResponse.json({ error: "پارامتر نامعتبر" }, { status: 400 });
}

// POST /api/messages — send a message
export async function POST(req: NextRequest) {
  const currentUser = await getCurrentUser();
  if (!currentUser) {
    return NextResponse.json({ error: "دسترسی غیرمجاز" }, { status: 403 });
  }

  try {
    const { recipientId, body } = await req.json();
    if (!recipientId || !body?.trim()) {
      return NextResponse.json({ error: "گیرنده و متن الزامی است" }, { status: 400 });
    }

    // Verify recipient exists and is approved
    const recipient = await db.user.findUnique({
      where: { id: recipientId, status: "APPROVED" },
    });
    if (!recipient) {
      return NextResponse.json({ error: "گیرنده یافت نشد" }, { status: 404 });
    }

    // Employees can only message admins; admins can message anyone
    if (currentUser.role === "EMPLOYEE" && recipient.role !== "ADMIN") {
      return NextResponse.json({ error: "فقط می‌توانید به مدیر پیام دهید" }, { status: 403 });
    }

    const message = await db.directMessage.create({
      data: {
        senderId: currentUser.id,
        recipientId,
        body: body.trim(),
      },
    });

    return NextResponse.json({ ok: true, message });
  } catch (err) {
    return NextResponse.json({ error: "خطای سرور" }, { status: 500 });
  }
}
