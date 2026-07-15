import { prisma } from "@/lib/prisma";
import { AuditEventType, Prisma } from "@prisma/client";
import { RequestStatus } from "@prisma/client";

/**
 * Concurrency-safe voucher number issuance.
 *
 * Uses a Postgres row lock (SELECT ... FOR UPDATE inside a transaction) on the
 * VoucherSequence row for the fiscal year, so two simultaneous submissions can
 * never receive the same number — the second request simply waits for the
 * first transaction to commit, then reads the already-incremented value.
 * This is the direct equivalent of the ETag/If-Match retry loop described in
 * the SharePoint implementation guide (Appendix F.3), but native to Postgres.
 */
export async function issueVoucherNumber(fiscalYearId: string, fiscalYearCode: string): Promise<string> {
  return prisma.$transaction(async (tx) => {
    // Ensure a sequence row exists for this fiscal year.
    await tx.$executeRaw`
      INSERT INTO "VoucherSequence" ("fiscalYearId", "lastIssued", "updatedAt")
      VALUES (${fiscalYearId}, 0, now())
      ON CONFLICT ("fiscalYearId") DO NOTHING
    `;

    // Lock the row for the duration of this transaction.
    const rows = await tx.$queryRaw<{ lastIssued: number }[]>`
      SELECT "lastIssued" FROM "VoucherSequence"
      WHERE "fiscalYearId" = ${fiscalYearId}
      FOR UPDATE
    `;
    const current = rows[0]?.lastIssued ?? 0;
    const next = current + 1;

    await tx.$executeRaw`
      UPDATE "VoucherSequence" SET "lastIssued" = ${next}, "updatedAt" = now()
      WHERE "fiscalYearId" = ${fiscalYearId}
    `;

    return `PC-${fiscalYearCode}-${String(next).padStart(4, "0")}`;
  });
}

export async function writeAudit(params: {
  requestId?: string;
  voucherNo?: string | null;
  eventType: AuditEventType;
  actorId?: string;
  details?: string;
  fieldName?: string;
  oldValue?: string;
  newValue?: string;
}) {
  await prisma.auditLog.create({
    data: {
      requestId: params.requestId,
      voucherNo: params.voucherNo ?? undefined,
      eventType: params.eventType,
      actorId: params.actorId,
      details: params.details,
      fieldName: params.fieldName,
      oldValue: params.oldValue,
      newValue: params.newValue,
    },
  });
}

const APPROVED_STATUSES = ["FINALLY_APPROVED", "PAID", "SETTLED"] as const;
const PENDING_STATUSES = ["SUBMITTED", "APPROVED_BY_DD"] as const;

export async function totalAllocation(fiscalYearId: string): Promise<number> {
  const fy = await prisma.fiscalYear.findUniqueOrThrow({ where: { id: fiscalYearId } });
  const carry = fy.carryforwardStatus === "APPLIED" ? Number(fy.carryforwardAmount) : 0;
  return Number(fy.opening) + Number(fy.supplementary) + carry;
}
export async function approvedExpenditure(fiscalYearId: string): Promise<number> {
  const agg = await prisma.request.aggregate({
    where: { 
      fiscalYearId, 
      status: { in: APPROVED_STATUSES as unknown as any[] } 
    },
    _sum: { requestedAmount: true },
  });
  return Number(agg._sum.requestedAmount ?? 0);
}
export async function pendingCommitment(fiscalYearId: string): Promise<number> {
  const agg = await prisma.request.aggregate({
    where: { fiscalYearId, status: { in: PENDING_STATUSES as unknown as string[] } },
    _sum: { requestedAmount: true },
  });
  return Number(agg._sum.requestedAmount ?? 0);
}

export async function availableBalance(fiscalYearId: string): Promise<number> {
  const [total, approved] = await Promise.all([
    totalAllocation(fiscalYearId),
    approvedExpenditure(fiscalYearId),
  ]);
  return total - approved;
}

export async function budgetHeadSpent(budgetHeadId: string, fiscalYearId: string): Promise<number> {
  const agg = await prisma.request.aggregate({
    where: { budgetHeadId, fiscalYearId, status: { in: APPROVED_STATUSES as unknown as string[] } },
    _sum: { requestedAmount: true },
  });
  return Number(agg._sum.requestedAmount ?? 0);
}

export async function paidExpenditure(fiscalYearId: string): Promise<number> {
  const requests = await prisma.request.findMany({ where: { fiscalYearId }, select: { id: true } });
  const ids = requests.map((r) => r.id);
  if (ids.length === 0) return 0;
  const agg = await prisma.payment.aggregate({
    where: { requestId: { in: ids } },
    _sum: { paidAmount: true },
  });
  return Number(agg._sum.paidAmount ?? 0);
}

export function money(n: number | string): string {
  const num = typeof n === "string" ? Number(n) : n;
  return "PKR " + num.toLocaleString("en-PK", { maximumFractionDigits: 0 });
}

export async function activeFiscalYear() {
  const fy = await prisma.fiscalYear.findFirst({ where: { status: "OPEN" }, orderBy: { startDate: "desc" } });
  if (!fy) throw new Error("No open fiscal year configured. An administrator must create one.");
  return fy;
}

export async function resolveApprover(roleName: "DEPUTY_DIRECTOR" | "DIRECTOR"): Promise<string> {
  const config = await prisma.approverConfig.findUnique({ where: { roleName } });
  if (!config) throw new Error(`No approver configured for role ${roleName}`);
  const now = new Date();
  if (
    config.delegationActive &&
    config.backupApproverId &&
    config.delegationStart &&
    config.delegationEnd &&
    now >= config.delegationStart &&
    now <= config.delegationEnd
  ) {
    return config.backupApproverId;
  }
  return config.primaryApproverId;
}

export { Prisma };
