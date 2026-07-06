// app/api/signup/route.ts
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { hashPassword, isMainAdmin } from "@/lib/session";

export async function POST(req: NextRequest) {
  try {
    const { name, email, password } = await req.json();
    if (!name?.trim() || !email?.trim() || !password) {
      return NextResponse.json({ error: "تمامی فیلدها الزامی است" }, { status: 400 });
    }
    if (password.length < 6) {
      return NextResponse.json({ error: "گذرواژه حداقل ۶ کاراکتر" }, { status: 400 });
    }

    const normalizedEmail = email.toLowerCase().trim();

    // Check if email already exists (including deleted users).
    const existing = await db.user.findUnique({ where: { email: normalizedEmail } });
    if (existing) {
      if (existing.status === "DELETED") {
        return NextResponse.json({ error: "این ایمیل قبلاً استفاده شده بود. با مدیر تماس بگیرید." }, { status: 409 });
      }
      return NextResponse.json({ error: "ایمیل تکراری" }, { status: 409 });
    }

    // Main admin email gets ADMIN role + APPROVED immediately.
    // All other new users get PENDING status — they need admin approval.
    const isMain = isMainAdmin(normalizedEmail);
    const role = isMain ? "ADMIN" : "EMPLOYEE";
    const status = isMain ? "APPROVED" : "PENDING";

    const user = await db.user.create({
      data: { name: name.trim(), email: normalizedEmail, password: hashPassword(password), role, status },
    });

    // Don't auto-login PENDING users. Only main admin auto-logs-in.
    if (isMain) {
      const { setSession } = await import("@/lib/session");
      await setSession(user.id);
    }

    return NextResponse.json({
      ok: true,
      pending: !isMain,
      message: isMain
        ? "حساب مدیر ساخته شد"
        : "حساب شما ساخته شد. بعد از تأیید مدیر می‌توانید وارد شوید.",
    });
  } catch (err) {
    return NextResponse.json({ error: "خطای سرور" }, { status: 500 });
  }
}
