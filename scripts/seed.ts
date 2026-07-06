// scripts/seed.ts — seed initial users (admin + employees) into the database.
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const db = new PrismaClient();

async function main() {
  console.log("Seeding database...");

  // Clear existing data.
  await db.notification.deleteMany();
  await db.reportEntry.deleteMany();
  await db.user.deleteMany();

  // Create users (all APPROVED by default).
  await db.user.create({
    data: { name: "مدیر سیستم", email: "admin@zai.dev", password: bcrypt.hashSync("admin123", 10), role: "ADMIN", status: "APPROVED" },
  });
  await db.user.create({
    data: { name: "علی رضایی", email: "ali@zai.dev", password: bcrypt.hashSync("ali123", 10), role: "EMPLOYEE", status: "APPROVED" },
  });
  await db.user.create({
    data: { name: "سارا محمدی", email: "sara@zai.dev", password: bcrypt.hashSync("sara123", 10), role: "EMPLOYEE", status: "APPROVED" },
  });
  await db.user.create({
    data: { name: "رضا کریمی", email: "reza@zai.dev", password: bcrypt.hashSync("reza123", 10), role: "EMPLOYEE", status: "APPROVED" },
  });

  console.log("Users created (all APPROVED):");
  console.log("  ADMIN:    admin@zai.dev / admin123");
  console.log("  EMPLOYEE: ali@zai.dev / ali123");
  console.log("  EMPLOYEE: sara@zai.dev / sara123");
  console.log("  EMPLOYEE: reza@zai.dev / reza123");
  console.log("Done!");
}

main()
  .catch(console.error)
  .finally(() => db.$disconnect());
