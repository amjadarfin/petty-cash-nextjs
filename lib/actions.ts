"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import {
  issueVoucherNumber,
  writeAudit,
  activeFiscalYear,
  budgetHeadSpent,
  availableBalance,
  resolveApprover,
  totalAllocation,
  approvedExpenditure,
} from "@/lib/pettycash";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import fs from "fs/promises";
import path from "path";
import bcrypt from "bcryptjs";

const UPLOAD_DIR = path.join(process.cwd(), "storage", "evidence");
const ALLOWED_EXT = ["pdf", "jpg", "jpeg", "png", "heic", "docx", "xlsx"];
const MAX_SIZE = 25 * 1024 * 1024;

async function requireUser() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  return session.user;
}

async function saveEvidence(requestId: string, file: File): Promise<{ path: string; name: string }> {
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  if (!ALLOWED_EXT.includes(ext)) throw new Error("File type not allowed.");
  if (file.size > MAX_SIZE) throw new Error("File exceeds 25MB limit.");

  await fs.mkdir(UPLOAD_DIR, { recursive: true });
  const safeName = `${requestId}-${Date.now()}.${ext}`;
  const buf = Buffer.from(await file.arrayBuffer());
  await fs.writeFile(path.join(UPLOAD_DIR, safeName), buf);
  return { path: safeName, name: file.name };
}

/Submit / Save Draft ----------
export async function submitRequestAction(formData: FormData) {
  const user = await requireUser();
  const fy = await activeFiscalYear();

  const doSubmit = formData.get("intent") === "submit";
  const vendorPayee = String(formData.get("vendorPayee") || "").trim();
  const purpose = String(formData.get("purpose") || "").trim();
  const budgetHeadId = String(formData.get("budgetHeadId") || "");
  const requestedAmount = Number(formData.get("requestedAmount") || 0);
  const expenseDate = new Date(String(formData.get("expenseDate")));
  const exceptionReason = String(formData.get("exceptionReason") || "").trim();
  const file = formData.get("evidence") as File | null;

  if (doSubmit) {
    if (!vendorPayee || !purpose || !budgetHeadId || !requestedAmount || requestedAmount <= 0) {
      throw new Error("Please complete all required fields with a positive amount.");
    }
    if ((!file || file.size === 0) && !exceptionReason) {
      throw new Error("Attach a receipt or provide an exception reason.");
    }
    if (fy.status !== "OPEN") throw new Error("The current fiscal year is not open for submissions.");
  }

  const request = await prisma.request.create({
    data: {
      fiscalYearId: fy.id,
      requesterId: user.id!,
      department: user.department,
      expenseDate,
      vendorPayee,
      purpose,
      budgetHeadId: budgetHeadId || undefined,
      requestedAmount: requestedAmount || 0,
      exceptionReason: exceptionReason || undefined,
      evidenceStatus: file && file.size > 0 ? "COMPLETE" : "EXCEPTION_REQUESTED",
      status: "DRAFT",
    },
  });

  if (file && file.size > 0) {
    const saved = await saveEvidence(request.id, file);
    await prisma.request.update({
      where: { id: request.id },
      data: { evidencePath: saved.path, evidenceFileName: saved.name },
    });
  }

  if (doSubmit) {
    const voucherNo = await issueVoucherNumber(fy.id, fy.code);
    const ddId = await resolveApprover("DEPUTY_DIRECTOR");
    await prisma.request.update({
      where: { id: request.id },
      data: { voucherNo, status: "SUBMITTED", requestDate: new Date(), currentApproverId: ddId },
    });
    await prisma.approvalAction.create({
      data: {
        requestId: request.id,
        voucherNo,
        cycleNo: 1,
        stage: "DEPUTY_DIRECTOR",
        decision: "Submitted",
        actorId: user.id!,
        comments: "Submitted by requester.",
      },
    });
    await writeAudit({ requestId: request.id, voucherNo, eventType: "REQUEST_LIFECYCLE", actorId: user.id, details: `Submitted — ${vendorPayee}` });
  } else {
    await writeAudit({ requestId: request.id, eventType: "REQUEST_LIFECYCLE", actorId: user.id, details: "Draft created" });
  }

  revalidatePath("/requests/mine");
  redirect("/requests/mine");
}

export async function resubmitRequestAction(requestId: string, formData: FormData) {
  const user = await requireUser();
  const existing = await prisma.request.findUniqueOrThrow({ where: { id: requestId } });
  if (existing.requesterId !== user.id) throw new Error("Not authorized.");
  if (!["DRAFT", "RETURNED_BY_DD", "RETURNED_BY_DIRECTOR"].includes(existing.status)) {
    throw new Error("This request can no longer be edited.");
  }

  const fy = await activeFiscalYear();
  const doSubmit = formData.get("intent") === "submit";
  const vendorPayee = String(formData.get("vendorPayee") || "").trim();
  const purpose = String(formData.get("purpose") || "").trim();
  const budgetHeadId = String(formData.get("budgetHeadId") || "");
  const requestedAmount = Number(formData.get("requestedAmount") || 0);
  const expenseDate = new Date(String(formData.get("expenseDate")));
  const exceptionReason = String(formData.get("exceptionReason") || "").trim();
  const file = formData.get("evidence") as File | null;

  if (doSubmit && (!vendorPayee || !purpose || !budgetHeadId || !requestedAmount || requestedAmount <= 0)) {
    throw new Error("Please complete all required fields.");
  }

  const wasReturned = existing.status !== "DRAFT";
  const data: Record<string, unknown> = { vendorPayee, purpose, budgetHeadId, requestedAmount, expenseDate, exceptionReason: exceptionReason || null };

  if (file && file.size > 0) {
    const saved = await saveEvidence(requestId, file);
    data.evidencePath = saved.path;
    data.evidenceFileName = saved.name;
    data.evidenceStatus = "COMPLETE";
  }

  if (doSubmit) {
    const cycleNo = wasReturned ? existing.cycleNo + 1 : existing.cycleNo;
    let voucherNo = existing.voucherNo;
    if (!voucherNo) voucherNo = await issueVoucherNumber(fy.id, fy.code);
    const ddId = await resolveApprover("DEPUTY_DIRECTOR");
    data.voucherNo = voucherNo;
    data.status = "SUBMITTED";
    data.requestDate = new Date();
    data.currentApproverId = ddId;
    data.cycleNo = cycleNo;

    await prisma.request.update({ where: { id: requestId }, data });
    await prisma.approvalAction.create({
      data: {
        requestId,
        voucherNo,
        cycleNo,
        stage: "DEPUTY_DIRECTOR",
        decision: wasReturned ? "Resubmitted" : "Submitted",
        actorId: user.id!,
        comments: wasReturned ? "Resubmitted after return." : "Submitted by requester.",
      },
    });
    await writeAudit({ requestId, voucherNo, eventType: "REQUEST_LIFECYCLE", actorId: user.id, details: `Cycle ${cycleNo}` });
  } else {
    await prisma.request.update({ where: { id: requestId }, data });
    await writeAudit({ requestId, eventType: "REQUEST_LIFECYCLE", actorId: user.id, details: "Draft updated" });
  }

  revalidatePath("/requests/mine");
  redirect("/requests/mine");
}

// ---------- Deputy Director decision ----------
export async function decideDDAction(requestId: string, decision: "Approve" | "Return" | "Reject", comments: string) {
  const user = await requireUser();
  if (user.role !== "DEPUTY_DIRECTOR" && user.role !== "SYSTEM_OWNER") throw new Error("Not authorized.");
  if (!comments.trim()) throw new Error("Comments are mandatory.");

  const req = await prisma.request.findUniqueOrThrow({ where: { id: requestId } });
  if (req.status !== "SUBMITTED") throw new Error("This request is not awaiting Deputy Director review.");

  await prisma.approvalAction.create({
    data: { requestId, voucherNo: req.voucherNo, cycleNo: req.cycleNo, stage: "DEPUTY_DIRECTOR", decision, actorId: user.id!, comments },
  });

  if (decision === "Approve") {
    const spent = await budgetHeadSpent(req.budgetHeadId, req.fiscalYearId);
    const head = await prisma.budgetHead.findUniqueOrThrow({ where: { id: req.budgetHeadId } });
    const limit = Number(head.annualLimit);
    const pct = limit > 0 ? ((spent + Number(req.requestedAmount)) / limit) * 100 : 0;
    const flag = pct >= head.thresholdPercent;
    const directorId = await resolveApprover("DIRECTOR");

    await prisma.request.update({
      where: { id: requestId },
      data: {
        status: "APPROVED_BY_DD",
        ddDecision: decision,
        ddComments: comments,
        ddDecisionDate: new Date(),
        currentApproverId: directorId,
        budgetThresholdFlag: flag,
      },
    });
    await writeAudit({ requestId, voucherNo: req.voucherNo, eventType: "APPROVAL", actorId: user.id, details: comments });
  } else if (decision === "Return") {
    await prisma.request.update({
      where: { id: requestId },
      data: { status: "RETURNED_BY_DD", ddDecision: decision, ddComments: comments, ddDecisionDate: new Date(), currentApproverId: req.requesterId },
    });
    await writeAudit({ requestId, voucherNo: req.voucherNo, eventType: "APPROVAL", actorId: user.id, details: comments });
  } else {
    await prisma.request.update({
      where: { id: requestId },
      data: { status: "REJECTED_BY_DD", ddDecision: decision, ddComments: comments, ddDecisionDate: new Date(), recordLocked: true, currentApproverId: null },
    });
    await writeAudit({ requestId, voucherNo: req.voucherNo, eventType: "APPROVAL", actorId: user.id, details: comments });
  }

  revalidatePath("/approvals/dd");
}

// ---------- Director decision ----------
export async function decideDirectorAction(requestId: string, decision: "FinalApprove" | "Return" | "Reject", comments: string) {
  const user = await requireUser();
  if (user.role !== "DIRECTOR" && user.role !== "SYSTEM_OWNER") throw new Error("Not authorized.");
  if (!comments.trim()) throw new Error("Comments are mandatory.");

  const req = await prisma.request.findUniqueOrThrow({ where: { id: requestId } });
  if (req.status !== "APPROVED_BY_DD") throw new Error("This request is not awaiting Director review.");

  if (decision === "FinalApprove") {
    const available = await availableBalance(req.fiscalYearId);
    if (Number(req.requestedAmount) > available) {
      throw new Error("Final approval blocked: amount exceeds the available balance.");
    }
  }

  await prisma.approvalAction.create({
    data: { requestId, voucherNo: req.voucherNo, cycleNo: req.cycleNo, stage: "DIRECTOR", decision, actorId: user.id!, comments },
  });

  if (decision === "FinalApprove") {
    await prisma.request.update({
      where: { id: requestId },
      data: { status: "FINALLY_APPROVED", directorDecision: decision, directorComments: comments, directorDecisionDate: new Date(), recordLocked: true, currentApproverId: null },
    });
    await writeAudit({ requestId, voucherNo: req.voucherNo, eventType: "APPROVAL", actorId: user.id, details: comments });
  } else if (decision === "Return") {
    await prisma.request.update({
      where: { id: requestId },
      data: { status: "RETURNED_BY_DIRECTOR", directorDecision: decision, directorComments: comments, directorDecisionDate: new Date(), currentApproverId: req.requesterId },
    });
    await writeAudit({ requestId, voucherNo: req.voucherNo, eventType: "APPROVAL", actorId: user.id, details: comments });
  } else {
    await prisma.request.update({
      where: { id: requestId },
      data: { status: "REJECTED_BY_DIRECTOR", directorDecision: decision, directorComments: comments, directorDecisionDate: new Date(), recordLocked: true, currentApproverId: null },
    });
    await writeAudit({ requestId, voucherNo: req.voucherNo, eventType: "APPROVAL", actorId: user.id, details: comments });
  }

  revalidatePath("/approvals/director");
}

// ---------- Payments ----------
export async function recordPaymentAction(formData: FormData) {
  const user = await requireUser();
  if (user.role !== "ACCOUNTS" && user.role !== "SYSTEM_OWNER") throw new Error("Not authorized.");

  const requestId = String(formData.get("requestId"));
  const paidAmount = Number(formData.get("paidAmount") || 0);
  const paymentDate = new Date(String(formData.get("paymentDate")));
  const method = String(formData.get("method"));
  const reference = String(formData.get("reference") || "");
  const settled = formData.get("settled") === "on";

  const req = await prisma.request.findUniqueOrThrow({ where: { id: requestId } });
  if (req.status !== "FINALLY_APPROVED" && req.status !== "PAID") throw new Error("Not eligible for payment.");

  const paidSoFar = await prisma.payment.aggregate({ where: { requestId }, _sum: { paidAmount: true } });
  const already = Number(paidSoFar._sum.paidAmount ?? 0);
  if (!paidAmount || paidAmount <= 0) throw new Error("Enter a valid amount.");
  if (already + paidAmount > Number(req.requestedAmount)) throw new Error("Payment total cannot exceed the approved amount.");

  await prisma.payment.create({
    data: {
      requestId,
      voucherNo: req.voucherNo,
      paidAmount,
      paymentDate,
      method,
      reference,
      recordedById: user.id!,
      settlementStatus: settled ? "Settled" : "Recorded",
    },
  });

  const newTotal = already + paidAmount;
  const newPaymentStatus = newTotal >= Number(req.requestedAmount) ? "PAID" : "PART_PAID";
  const newStatus = settled ? "SETTLED" : newTotal >= Number(req.requestedAmount) ? "PAID" : req.status;

  await prisma.request.update({
    where: { id: requestId },
    data: { paymentStatus: settled ? "SETTLED" : newPaymentStatus, status: newStatus },
  });

  await writeAudit({ requestId, voucherNo: req.voucherNo, eventType: "FINANCIAL_CHANGES", actorId: user.id, details: `Payment of ${paidAmount} via ${method}${settled ? " (Settled)" : ""}` });
  revalidatePath("/payments");
}

export async function markSettledAction(requestId: string) {
  const user = await requireUser();
  if (user.role !== "ACCOUNTS" && user.role !== "SYSTEM_OWNER") throw new Error("Not authorized.");
  const req = await prisma.request.update({ where: { id: requestId }, data: { status: "SETTLED", paymentStatus: "SETTLED" } });
  await writeAudit({ requestId, voucherNo: req.voucherNo, eventType: "FINANCIAL_CHANGES", actorId: user.id, details: "Marked settled" });
  revalidatePath("/payments/open");
}

// ---------- Admin ----------
export async function updateBudgetHeadAction(formData: FormData) {
  const user = await requireUser();
  if (user.role !== "SYSTEM_OWNER") throw new Error("Not authorized.");
  const id = String(formData.get("id"));
  const name = String(formData.get("name"));
  const annualLimit = Number(formData.get("annualLimit"));
  const thresholdPercent = Number(formData.get("thresholdPercent"));
  const active = formData.get("active") === "on";

  await prisma.budgetHead.update({ where: { id }, data: { name, annualLimit, thresholdPercent, active } });
  await writeAudit({ eventType: "ACCESS_ADMIN", actorId: user.id, details: `Budget head updated: ${name}` });
  revalidatePath("/admin");
}

export async function addBudgetHeadAction(formData: FormData) {
  const user = await requireUser();
  if (user.role !== "SYSTEM_OWNER") throw new Error("Not authorized.");
  const code = String(formData.get("code")).toUpperCase();
  const name = String(formData.get("name"));
  const annualLimit = Number(formData.get("annualLimit"));
  const thresholdPercent = Number(formData.get("thresholdPercent") || 80);

  await prisma.budgetHead.create({ data: { code, name, annualLimit, thresholdPercent, active: true } });
  await writeAudit({ eventType: "ACCESS_ADMIN", actorId: user.id, details: `Budget head created: ${name}` });
  revalidatePath("/admin");
}
