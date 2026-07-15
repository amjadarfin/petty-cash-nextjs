import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const password = await bcrypt.hash("Passw0rd!", 10);

  const [ayesha, bilal, nadia, imran, sana, owner] = await Promise.all([
    prisma.user.upsert({
      where: { email: "ayesha@example.gov" },
      update: {},
      create: { name: "Ayesha Khan", email: "ayesha@example.gov", passwordHash: password, role: "STAFF", department: "Administration" },
    }),
    prisma.user.upsert({
      where: { email: "bilal@example.gov" },
      update: {},
      create: { name: "Bilal Ahmed", email: "bilal@example.gov", passwordHash: password, role: "STAFF", department: "IT" },
    }),
    prisma.user.upsert({
      where: { email: "nadia@example.gov" },
      update: {},
      create: { name: "Nadia Farooq", email: "nadia@example.gov", passwordHash: password, role: "DEPUTY_DIRECTOR", department: "Office of the Deputy Director" },
    }),
    prisma.user.upsert({
      where: { email: "imran@example.gov" },
      update: {},
      create: { name: "Imran Sheikh", email: "imran@example.gov", passwordHash: password, role: "DIRECTOR", department: "Director's Office" },
    }),
    prisma.user.upsert({
      where: { email: "sana@example.gov" },
      update: {},
      create: { name: "Sana Malik", email: "sana@example.gov", passwordHash: password, role: "ACCOUNTS", department: "Accounts" },
    }),
    prisma.user.upsert({
      where: { email: "owner@example.gov" },
      update: {},
      create: { name: "System Owner", email: "owner@example.gov", passwordHash: password, role: "SYSTEM_OWNER", department: "IT" },
    }),
  ]);

  const fyCode = process.env.SEED_FY_CODE || "2026";
  const opening = Number(process.env.SEED_FY_OPENING || "1000000");

  const fy = await prisma.fiscalYear.upsert({
    where: { code: fyCode },
    update: {},
    create: {
      name: `FY${fyCode}`,
      code: fyCode,
      startDate: new Date(`${fyCode}-07-01`),
      endDate: new Date(`${Number(fyCode) + 1}-06-30`),
      opening,
      status: "OPEN",
    },
  });

  await prisma.voucherSequence.upsert({
    where: { fiscalYearId: fy.id },
    update: {},
    create: { fiscalYearId: fy.id, lastIssued: 0 },
  });

  const heads = [
    { code: "OFC", name: "Office Supplies", annualLimit: 200000 },
    { code: "TRV", name: "Local Travel & Conveyance", annualLimit: 250000 },
    { code: "UTL", name: "Utilities & Communication", annualLimit: 150000 },
    { code: "MNT", name: "Repairs & Maintenance", annualLimit: 200000 },
    { code: "MSC", name: "Miscellaneous", annualLimit: 200000 },
  ];
  for (const h of heads) {
    await prisma.budgetHead.upsert({
      where: { code: h.code },
      update: {},
      create: { ...h, thresholdPercent: 80, active: true },
    });
  }

  await prisma.approverConfig.upsert({
    where: { roleName: "DEPUTY_DIRECTOR" },
    update: { primaryApproverId: nadia.id },
    create: { roleName: "DEPUTY_DIRECTOR", primaryApproverId: nadia.id },
  });
  await prisma.approverConfig.upsert({
    where: { roleName: "DIRECTOR" },
    update: { primaryApproverId: imran.id },
    create: { roleName: "DIRECTOR", primaryApproverId: imran.id },
  });

  console.log("Seed complete.");
  console.log("Login with any of these emails, password: Passw0rd!");
  [ayesha, bilal, nadia, imran, sana, owner].forEach((u) => console.log(" -", u.email, `(${u.role})`));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
