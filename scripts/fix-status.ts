// scripts/fix-status.ts — one-time script to set all existing users to APPROVED.
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

async function main() {
  console.log("Fixing user statuses...");

  const result = await db.user.updateMany({
    where: { status: { not: "DELETED" } },
    data: { status: "APPROVED" },
  });

  console.log(`Updated ${result.count} users to APPROVED.`);

  // Show the result.
  const users = await db.user.findMany({
    select: { id: true, name: true, email: true, role: true, status: true },
  });
  console.log("Current users:");
  for (const u of users) {
    console.log(`  ${u.name} (${u.email}) — ${u.role} — ${u.status}`);
  }
}

main()
  .catch(console.error)
  .finally(() => db.$disconnect());
