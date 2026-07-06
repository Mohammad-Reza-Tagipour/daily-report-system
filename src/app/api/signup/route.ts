// app/api/signup/route.ts
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { hashPassword, setSession, isMainAdmin } from "@/lib/session";

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
    const existing = await db.user.findUnique({ where: { email: normalizedEmail } });
    if (existing) {
      return NextResponse.json({ error: "ایمیل تکراری" }, { status: 409 });
    }

    const role = isMainAdmin(normalizedEmail) ? "ADMIN" : "EMPLOYEE";
    const user = await db.user.create({
      data: { name: name.trim(), email: normalizedEmail, password: hashPassword(password), role },
    });

    await setSession(user.id);
    return NextResponse.json({
      ok: true,
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
    });
  } catch (err) {
    return NextResponse.json({ error: "خطای سرور" }, { status: 500 });
  }
}
