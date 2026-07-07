// app/api/leaves/route.ts — Leave requests (مرخصی)
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";

// GET /api/leaves — current user's leaves (or all for admin)
export async function GET(req: NextRequest) {
  const currentUser = await getCurrentUser();
  if (!currentUser) {
    return NextResponse.json({ error: "دسترسی غیرمجاز" }, { status: 403 });
  }

  const url = new URL(req.url);
  const all = url.searchParams.get("all") === "true";

  if (all && currentUser.role === "ADMIN") {
    const leaves = await db.leaveRequest.findMany({
      orderBy: { createdAt: "desc" },
      include: { user: { select: { id: true, name: true, email: true } } },
    });
    return NextResponse.json({ leaves });
  }

  const leaves = await db.leaveRequest.findMany({
    where: { userId: currentUser.id },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ leaves });
}

// POST /api/leaves — create a leave request (employee) OR approve/reject (admin)
export async function POST(req: NextRequest) {
  const currentUser = await getCurrentUser();
  if (!currentUser) {
    return NextResponse.json({ error: "دسترسی غیرمجاز" }, { status: 403 });
  }

  try {
    const body = await req.json();

    // Admin approve/reject action
    if (body.action && body.leaveId) {
      if (currentUser.role !== "ADMIN") {
        return NextResponse.json({ error: "فقط مدیر" }, { status: 403 });
      }
      const updated = await db.leaveRequest.update({
        where: { id: body.leaveId },
        data: {
          status: body.action === "APPROVE" ? "APPROVED" : "REJECTED",
          adminNote: body.adminNote || null,
        },
      });
      return NextResponse.json({ ok: true, leave: updated });
    }

    // Employee create request
    const { startDate, endDate, reason } = body;
    if (!startDate?.trim() || !endDate?.trim() || !reason?.trim()) {
      return NextResponse.json({ error: "تاریخ و دلیل الزامی است" }, { status: 400 });
    }

    const leave = await db.leaveRequest.create({
      data: {
        userId: currentUser.id,
        startDate: startDate.trim(),
        endDate: endDate.trim(),
        reason: reason.trim(),
      },
    });

    return NextResponse.json({ ok: true, leave });
  } catch (err) {
    return NextResponse.json({ error: "خطای سرور" }, { status: 500 });
  }
}
