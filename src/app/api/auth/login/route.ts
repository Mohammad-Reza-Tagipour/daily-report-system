// app/api/auth/login/route.ts
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { setSession, verifyPassword, isMainAdmin } from "@/lib/session";

export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json();
    if (!email || !password) {
      return NextResponse.json({ error: "ایمیل و گذرواژه الزامی است" }, { status: 400 });
    }

    const user = await db.user.findUnique({ where: { email: email.toLowerCase().trim() } });
    if (!user || !verifyPassword(password, user.password)) {
      return NextResponse.json({ error: "ایمیل یا گذرواژه اشتباه است" }, { status: 401 });
    }

    await setSession(user.id);
    return NextResponse.json({
      ok: true,
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
    });
  } catch (err) {
    return NextResponse.json({ error: "خطای سرور" }, { status: 500 });
  }
}
