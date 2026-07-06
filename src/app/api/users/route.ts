// app/api/users/route.ts — GET users, POST add employee, PATCH toggle role, DELETE user
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser, hashPassword, isMainAdmin } from "@/lib/session";

// GET /api/users?status=APPROVED|PENDING|DELETED
export async function GET(req: NextRequest) {
  const currentUser = await getCurrentUser();
  if (!currentUser || currentUser.role !== "ADMIN") {
    return NextResponse.json({ error: "دسترسی غیرمجاز" }, { status: 403 });
  }

  const url = new URL(req.url);
  const statusFilter = url.searchParams.get("status") || "APPROVED";

  const users = await db.user.findMany({
    where: { status: statusFilter },
    select: { id: true, name: true, email: true, role: true, status: true, createdAt: true },
    orderBy: { name: "asc" },
  });

  // Add entry count for each user.
  const enriched = await Promise.all(
    users.map(async (u) => ({
      ...u,
      entryCount: await db.reportEntry.count({ where: { userId: u.id } }),
    }))
  );

  return NextResponse.json({ users: enriched });
}

// POST /api/users — add a new employee (admin only)
export async function POST(req: NextRequest) {
  const currentUser = await getCurrentUser();
  if (!currentUser || currentUser.role !== "ADMIN") {
    return NextResponse.json({ error: "دسترسی غیرمجاز" }, { status: 403 });
  }

  try {
    const { name, email } = await req.json();
    if (!name?.trim() || !email?.trim()) {
      return NextResponse.json({ error: "نام و ایمیل الزامی است" }, { status: 400 });
    }

    const normalizedEmail = email.toLowerCase().trim();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(normalizedEmail)) {
      return NextResponse.json({ error: "ایمیل معتبر نیست" }, { status: 400 });
    }

    const existing = await db.user.findUnique({ where: { email: normalizedEmail } });
    if (existing) {
      return NextResponse.json({ error: "ایمیل تکراری" }, { status: 409 });
    }

    const user = await db.user.create({
      data: {
        name: name.trim(),
        email: normalizedEmail,
        password: hashPassword("password123"),
        role: "EMPLOYEE",
        status: "APPROVED", // Admin-created users are auto-approved.
      },
    });

    return NextResponse.json({
      ok: true,
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
    });
  } catch (err) {
    return NextResponse.json({ error: "خطای سرور" }, { status: 500 });
  }
}

// PATCH /api/users — toggle role OR approve user OR restore deleted user
export async function PATCH(req: NextRequest) {
  const currentUser = await getCurrentUser();
  if (!currentUser || currentUser.role !== "ADMIN") {
    return NextResponse.json({ error: "دسترسی غیرمجاز" }, { status: 403 });
  }

  try {
    const { userId, action } = await req.json();
    if (!userId) {
      return NextResponse.json({ error: "شناسه کاربر الزامی است" }, { status: 400 });
    }

    const target = await db.user.findUnique({ where: { id: userId } });
    if (!target) {
      return NextResponse.json({ error: "کاربر یافت نشد" }, { status: 404 });
    }

    // Action: APPROVE a pending user
    if (action === "APPROVE") {
      const updated = await db.user.update({
        where: { id: userId },
        data: { status: "APPROVED" },
        select: { id: true, name: true, email: true, role: true, status: true },
      });
      return NextResponse.json({ ok: true, user: updated });
    }

    // Action: RESTORE a deleted user
    if (action === "RESTORE") {
      const updated = await db.user.update({
        where: { id: userId },
        data: { status: "APPROVED" },
        select: { id: true, name: true, email: true, role: true, status: true },
      });
      return NextResponse.json({ ok: true, user: updated });
    }

    // Action: toggle role (default)
    // Rule 1: main admin can never be changed.
    if (isMainAdmin(target.email)) {
      return NextResponse.json({ error: "نقش مدیر اصلی قابل تغییر نیست" }, { status: 403 });
    }

    const isCurrentlyAdmin = target.role === "ADMIN";
    const actorIsMainAdmin = isMainAdmin(currentUser.email);

    // Rule 2: only main admin can demote admins.
    if (isCurrentlyAdmin && !actorIsMainAdmin) {
      return NextResponse.json({ error: "فقط مدیر اصلی می‌تواند مدیران را تنزل دهد" }, { status: 403 });
    }

    const newRole = isCurrentlyAdmin ? "EMPLOYEE" : "ADMIN";
    const updated = await db.user.update({
      where: { id: userId },
      data: { role: newRole },
      select: { id: true, name: true, email: true, role: true, status: true },
    });

    return NextResponse.json({ ok: true, user: updated });
  } catch (err) {
    return NextResponse.json({ error: "خطای سرور" }, { status: 500 });
  }
}

// DELETE /api/users — soft-delete a user (status = DELETED, data preserved)
export async function DELETE(req: NextRequest) {
  const currentUser = await getCurrentUser();
  if (!currentUser || currentUser.role !== "ADMIN") {
    return NextResponse.json({ error: "دسترسی غیرمجاز" }, { status: 403 });
  }

  try {
    const { userId } = await req.json();
    if (!userId) {
      return NextResponse.json({ error: "شناسه کاربر الزامی است" }, { status: 400 });
    }

    const target = await db.user.findUnique({ where: { id: userId } });
    if (!target) {
      return NextResponse.json({ error: "کاربر یافت نشد" }, { status: 404 });
    }

    // Can't delete the main admin.
    if (isMainAdmin(target.email)) {
      return NextResponse.json({ error: "مدیر اصلی قابل حذف نیست" }, { status: 403 });
    }

    // Can't delete yourself.
    if (userId === currentUser.id) {
      return NextResponse.json({ error: "نمی‌توانید حساب خودتان را حذف کنید" }, { status: 403 });
    }

    // Soft-delete: set status to DELETED. Data (entries, notifications) is preserved.
    const updated = await db.user.update({
      where: { id: userId },
      data: { status: "DELETED" },
      select: { id: true, name: true, email: true, role: true, status: true },
    });

    return NextResponse.json({ ok: true, user: updated });
  } catch (err) {
    return NextResponse.json({ error: "خطای سرور" }, { status: 500 });
  }
}
