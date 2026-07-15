-- CreateEnum
CREATE TYPE "Role" AS ENUM ('STAFF', 'DEPUTY_DIRECTOR', 'DIRECTOR', 'ACCOUNTS', 'SYSTEM_OWNER');

-- CreateEnum
CREATE TYPE "RequestStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'RETURNED_BY_DD', 'REJECTED_BY_DD', 'APPROVED_BY_DD', 'RETURNED_BY_DIRECTOR', 'REJECTED_BY_DIRECTOR', 'FINALLY_APPROVED', 'PAID', 'SETTLED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "EvidenceStatus" AS ENUM ('COMPLETE', 'EXCEPTION_REQUESTED', 'INCOMPLETE');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('NOT_PAID', 'PART_PAID', 'PAID', 'SETTLED');

-- CreateEnum
CREATE TYPE "FiscalYearStatus" AS ENUM ('OPEN', 'CLOSED');

-- CreateEnum
CREATE TYPE "CarryforwardStatus" AS ENUM ('NONE', 'PROPOSED', 'APPROVED', 'APPLIED', 'LAPSED');

-- CreateEnum
CREATE TYPE "ApprovalStage" AS ENUM ('DEPUTY_DIRECTOR', 'DIRECTOR', 'AMENDMENT');

-- CreateEnum
CREATE TYPE "AuditEventType" AS ENUM ('REQUEST_LIFECYCLE', 'FINANCIAL_CHANGES', 'EVIDENCE', 'APPROVAL', 'ACCESS_ADMIN', 'TECHNICAL');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "department" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApproverConfig" (
    "id" TEXT NOT NULL,
    "roleName" "Role" NOT NULL,
    "primaryApproverId" TEXT NOT NULL,
    "backupApproverId" TEXT,
    "delegationActive" BOOLEAN NOT NULL DEFAULT false,
    "delegationStart" TIMESTAMP(3),
    "delegationEnd" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ApproverConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FiscalYear" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "opening" DECIMAL(14,2) NOT NULL,
    "supplementary" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "carryforwardAmount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "carryforwardStatus" "CarryforwardStatus" NOT NULL DEFAULT 'NONE',
    "status" "FiscalYearStatus" NOT NULL DEFAULT 'OPEN',
    "closedAt" TIMESTAMP(3),
    "closedBy" TEXT,

    CONSTRAINT "FiscalYear_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VoucherSequence" (
    "fiscalYearId" TEXT NOT NULL,
    "lastIssued" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VoucherSequence_pkey" PRIMARY KEY ("fiscalYearId")
);

-- CreateTable
CREATE TABLE "BudgetHead" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "annualLimit" DECIMAL(14,2) NOT NULL,
    "thresholdPercent" INTEGER NOT NULL DEFAULT 80,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "BudgetHead_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Request" (
    "id" TEXT NOT NULL,
    "voucherNo" TEXT,
    "fiscalYearId" TEXT NOT NULL,
    "cycleNo" INTEGER NOT NULL DEFAULT 1,
    "requesterId" TEXT NOT NULL,
    "department" TEXT,
    "requestDate" TIMESTAMP(3),
    "expenseDate" TIMESTAMP(3) NOT NULL,
    "vendorPayee" TEXT NOT NULL,
    "purpose" TEXT NOT NULL,
    "budgetHeadId" TEXT NOT NULL,
    "requestedAmount" DECIMAL(14,2) NOT NULL,
    "actualAmount" DECIMAL(14,2),
    "evidencePath" TEXT,
    "evidenceFileName" TEXT,
    "evidenceStatus" "EvidenceStatus" NOT NULL DEFAULT 'COMPLETE',
    "exceptionReason" TEXT,
    "status" "RequestStatus" NOT NULL DEFAULT 'DRAFT',
    "currentApproverId" TEXT,
    "ddDecision" TEXT,
    "ddComments" TEXT,
    "ddDecisionDate" TIMESTAMP(3),
    "directorDecision" TEXT,
    "directorComments" TEXT,
    "directorDecisionDate" TIMESTAMP(3),
    "paymentStatus" "PaymentStatus" NOT NULL DEFAULT 'NOT_PAID',
    "recordLocked" BOOLEAN NOT NULL DEFAULT false,
    "budgetThresholdFlag" BOOLEAN NOT NULL DEFAULT false,
    "duplicateKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Request_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApprovalAction" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "voucherNo" TEXT,
    "cycleNo" INTEGER NOT NULL,
    "stage" "ApprovalStage" NOT NULL,
    "decision" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "actionDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "comments" TEXT NOT NULL,

    CONSTRAINT "ApprovalAction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payment" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "voucherNo" TEXT,
    "paidAmount" DECIMAL(14,2) NOT NULL,
    "paymentDate" TIMESTAMP(3) NOT NULL,
    "method" TEXT NOT NULL,
    "reference" TEXT,
    "recordedById" TEXT NOT NULL,
    "settlementStatus" TEXT NOT NULL DEFAULT 'Recorded',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "requestId" TEXT,
    "voucherNo" TEXT,
    "eventType" "AuditEventType" NOT NULL,
    "fieldName" TEXT,
    "oldValue" TEXT,
    "newValue" TEXT,
    "actorId" TEXT,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "details" TEXT,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "ApproverConfig_roleName_key" ON "ApproverConfig"("roleName");

-- CreateIndex
CREATE UNIQUE INDEX "FiscalYear_code_key" ON "FiscalYear"("code");

-- CreateIndex
CREATE UNIQUE INDEX "BudgetHead_code_key" ON "BudgetHead"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Request_voucherNo_key" ON "Request"("voucherNo");

-- CreateIndex
CREATE INDEX "Request_status_idx" ON "Request"("status");

-- CreateIndex
CREATE INDEX "Request_fiscalYearId_idx" ON "Request"("fiscalYearId");

-- CreateIndex
CREATE INDEX "Request_budgetHeadId_idx" ON "Request"("budgetHeadId");

-- CreateIndex
CREATE INDEX "Request_requesterId_idx" ON "Request"("requesterId");

-- CreateIndex
CREATE INDEX "ApprovalAction_requestId_idx" ON "ApprovalAction"("requestId");

-- CreateIndex
CREATE INDEX "Payment_requestId_idx" ON "Payment"("requestId");

-- CreateIndex
CREATE INDEX "AuditLog_requestId_idx" ON "AuditLog"("requestId");

-- CreateIndex
CREATE INDEX "AuditLog_timestamp_idx" ON "AuditLog"("timestamp");

-- AddForeignKey
ALTER TABLE "VoucherSequence" ADD CONSTRAINT "VoucherSequence_fiscalYearId_fkey" FOREIGN KEY ("fiscalYearId") REFERENCES "FiscalYear"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Request" ADD CONSTRAINT "Request_fiscalYearId_fkey" FOREIGN KEY ("fiscalYearId") REFERENCES "FiscalYear"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Request" ADD CONSTRAINT "Request_requesterId_fkey" FOREIGN KEY ("requesterId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Request" ADD CONSTRAINT "Request_budgetHeadId_fkey" FOREIGN KEY ("budgetHeadId") REFERENCES "BudgetHead"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApprovalAction" ADD CONSTRAINT "ApprovalAction_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "Request"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApprovalAction" ADD CONSTRAINT "ApprovalAction_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "Request"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_recordedById_fkey" FOREIGN KEY ("recordedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "Request"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
