// app/api/auth/me/route.ts
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { db } from "@/lib/db";

export async function GET() {
  const sessionUser = await getCurrentUser();
  if (!sessionUser) {
    return NextResponse.json({ user: null }, { status: 200 });
  }

  // Re-check the user's status from DB (they might have been deleted or pending).
  const user = await db.user.findUnique({
    where: { id: sessionUser.id },
    select: { id: true, name: true, email: true, role: true, status: true },
  });

  if (!user || user.status !== "APPROVED") {
    return NextResponse.json({ user: null }, { status: 200 });
  }

  return NextResponse.json({
    user: { id: user.id, name: user.name, email: user.email, role: user.role },
  });
}
