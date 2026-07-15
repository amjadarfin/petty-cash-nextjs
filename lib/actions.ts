// ---------- Director decision ----------
export async function decideDirectorAction(
  requestId: string,
  decision: "FinalApprove" | "Return" | "Reject",
  comments: string
) {
  const user = await requireUser();

  if (user.role !== "DIRECTOR" && user.role !== "SYSTEM_OWNER") {
    throw new Error("Not authorized.");
  }

  if (!comments.trim()) {
    throw new Error("Comments are mandatory.");
  }

  const req = await prisma.request.findUniqueOrThrow({
    where: { id: requestId },
  });

  if (req.status !== "APPROVED_BY_DD") {
    throw new Error(
      "This request is not awaiting Director review."
    );
  }

  if (decision === "FinalApprove") {
    const available = await availableBalance(req.fiscalYearId);

    if (Number(req.requestedAmount) > available) {
      throw new Error(
        "Final approval blocked: amount exceeds the available balance."
      );
    }
  }

  await prisma.approvalAction.create({
    data: {
      requestId,
      voucherNo: req.voucherNo,
      cycleNo: req.cycleNo,
      stage: "DIRECTOR",
      decision,
      actorId: user.id!,
      comments,
    },
  });

  if (decision === "FinalApprove") {
    await prisma.request.update({
      where: { id: requestId },
      data: {
        status: "FINALLY_APPROVED",
        directorDecision: decision,
        directorComments: comments,
        directorDecisionDate: new Date(),
        recordLocked: true,
        currentApproverId: null,
      },
    });

    await writeAudit({
      requestId,
      voucherNo: req.voucherNo,
      eventType: "APPROVAL",
      actorId: user.id,
      details: comments,
    });
  } else if (decision === "Return") {
    await prisma.request.update({
      where: { id: requestId },
      data: {
        status: "RETURNED_BY_DIRECTOR",
        directorDecision: decision,
        directorComments: comments,
        directorDecisionDate: new Date(),
        currentApproverId: req.requesterId,
      },
    });

    await writeAudit({
      requestId,
      voucherNo: req.voucherNo,
      eventType: "APPROVAL",
      actorId: user.id,
      details: comments,
    });
  } else {
    await prisma.request.update({
      where: { id: requestId },
      data: {
        status: "REJECTED_BY_DIRECTOR",
        directorDecision: decision,
        directorComments: comments,
        directorDecisionDate: new Date(),
        recordLocked: true,
        currentApproverId: null,
      },
    });

    await writeAudit({
      requestId,
      voucherNo: req.voucherNo,
      eventType: "APPROVAL",
      actorId: user.id,
      details: comments,
    });
  }

  revalidatePath("/approvals/director");
}

// ---------- Payments Accounting ----------
export async function recordPaymentAction(formData: FormData) {
  const user = await requireUser();

  if (user.role !== "ACCOUNTS" && user.role !== "SYSTEM_OWNER") {
    throw new Error("Not authorized.");
  }

  const requestId = String(formData.get("requestId"));
  const paidAmount = Number(formData.get("paidAmount") || 0);
  const paymentDate = new Date(String(formData.get("paymentDate")));
  const method = String(formData.get("method"));
  const reference = String(formData.get("reference") || "");
  const settled = formData.get("settled") === "on";

  const req = await prisma.request.findUniqueOrThrow({
    where: { id: requestId },
  });

  if (req.status !== "FINALLY_APPROVED" && req.status !== "PAID") {
    throw new Error("Not eligible for payment.");
  }

  const paidSoFar = await prisma.payment.aggregate({
    where: { requestId },
    _sum: {
      paidAmount: true,
    },
  });

  const already = Number(paidSoFar._sum.paidAmount ?? 0);

  if (!paidAmount || paidAmount <= 0) {
    throw new Error("Enter a valid amount.");
  }

  if (already + paidAmount > Number(req.requestedAmount)) {
    throw new Error(
      "Payment total cannot exceed the approved amount."
    );
  }

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

  const newPaymentStatus =
    newTotal >= Number(req.requestedAmount)
      ? "PAID"
      : "PART_PAID";

  const newStatus = settled
    ? "SETTLED"
    : newTotal >= Number(req.requestedAmount)
    ? "PAID"
    : req.status;

  await prisma.request.update({
    where: { id: requestId },
    data: {
      paymentStatus: settled
        ? "SETTLED"
        : newPaymentStatus,
      status: newStatus,
    },
  });

  await writeAudit({
    requestId,
    voucherNo: req.voucherNo,
    eventType: "FINANCIAL_CHANGES",
    actorId: user.id,
    details: `Payment of ${paidAmount} via ${method}${
      settled ? " (Settled)" : ""
    }`,
  });

  revalidatePath("/payments");
}

export async function markSettledAction(requestId: string) {
  const user = await requireUser();

  if (user.role !== "ACCOUNTS" && user.role !== "SYSTEM_OWNER") {
    throw new Error("Not authorized.");
  }

  const req = await prisma.request.update({
    where: {
      id: requestId,
    },
    data: {
      status: "SETTLED",
      paymentStatus: "SETTLED",
    },
  });

  await writeAudit({
    requestId,
    voucherNo: req.voucherNo,
    eventType: "FINANCIAL_CHANGES",
    actorId: user.id,
    details: "Marked settled",
  });

  revalidatePath("/payments/open");
}
// ---------- Budget Management & Admin ----------
export async function addBudgetHeadAction(formData: FormData) {
  const user = await requireUser();

  if (user.role !== "SYSTEM_OWNER") {
    throw new Error("Not authorized.");
  }

  const code = String(formData.get("code") || "").toUpperCase();
  const name = String(formData.get("name") || "");
  const annualLimit = Number(formData.get("annualLimit") || 0);
  const thresholdPercent = Number(
    formData.get("thresholdPercent") || 80
  );

  await prisma.budgetHead.create({
    data: {
      code,
      name,
      annualLimit,
      thresholdPercent,
      active: true,
    },
  });

  await writeAudit({
    eventType: "ACCESS_ADMIN",
    actorId: user.id,
    details: `Budget head created: ${name}`,
  });

  revalidatePath("/admin");
}

export async function updateBudgetHeadAction(formData: FormData) {
  const user = await requireUser();

  if (user.role !== "SYSTEM_OWNER") {
    throw new Error("Not authorized.");
  }

  const id = String(formData.get("id") || "");
  const name = String(formData.get("name") || "");
  const annualLimit = Number(formData.get("annualLimit") || 0);
  const thresholdPercent = Number(
    formData.get("thresholdPercent") || 80
  );
  const active = formData.get("active") === "on";

  await prisma.budgetHead.update({
    where: { id },
    data: {
      name,
      annualLimit,
      thresholdPercent,
      active,
    },
  });

  await writeAudit({
    eventType: "ACCESS_ADMIN",
    actorId: user.id,
    details: `Budget head updated: ${name}`,
  });

  revalidatePath("/admin");
}
// ---------- User Management ----------
export async function createUserAction(formData: FormData) {
  const admin = await requireUser();

  if (admin.role !== "SYSTEM_OWNER") {
    throw new Error("Not authorized.");
  }

  const name = String(formData.get("name") || "").trim();
  const email = String(formData.get("email") || "")
    .trim()
    .toLowerCase();
  const password = String(formData.get("password") || "");
  const role = String(formData.get("role") || "STAFF") as Role;
  const department = String(formData.get("department") || "").trim();

  if (!name || !email || !password) {
    throw new Error("All fields are required.");
  }

  if (password.length < 8) {
    throw new Error("Password must be at least 8 characters long.");
  }

  const existing = await prisma.user.findUnique({
    where: { email },
  });

  if (existing) {
    throw new Error("Email already registered.");
  }

  const passwordHash = await bcrypt.hash(password, 10);

  await prisma.user.create({
    data: {
      name,
      email,
      passwordHash,
      role,
      department,
      active: true,
    },
  });

  await writeAudit({
    eventType: "ACCESS_ADMIN",
    actorId: admin.id,
    details: `Created user account: ${email} (${role})`,
  });

  revalidatePath("/admin/users");
}

export async function toggleUserActiveAction(formData: FormData) {
  const admin = await requireUser();

  if (admin.role !== "SYSTEM_OWNER") {
    throw new Error("Not authorized.");
  }

  const id = String(formData.get("id") || "");
  const isActive = formData.get("active") === "on";

  await prisma.user.update({
    where: { id },
    data: {
      active: isActive,
    },
  });

  await writeAudit({
    eventType: "ACCESS_ADMIN",
    actorId: admin.id,
    details: `Changed user active state (ID: ${id}) to ${isActive}`,
  });

  revalidatePath("/admin/users");
}

export async function resetUserPasswordAction(formData: FormData) {
  const admin = await requireUser();

  if (admin.role !== "SYSTEM_OWNER") {
    throw new Error("Not authorized.");
  }

  const id = String(formData.get("id") || "");
  const newPassword = String(formData.get("newPassword") || "");

  if (!newPassword || newPassword.length < 8) {
    throw new Error("Password must be at least 8 characters long.");
  }

  const passwordHash = await bcrypt.hash(newPassword, 10);

  await prisma.user.update({
    where: { id },
    data: {
      passwordHash,
    },
  });

  await writeAudit({
    eventType: "ACCESS_ADMIN",
    actorId: admin.id,
    details: `Manually reset credential hash for user ID: ${id}`,
  });

  revalidatePath("/admin/users");
}
// ---------- System Configuration Actions ----------
export async function closeFiscalYearAction(formData: FormData) {
  const admin = await requireUser();

  if (admin.role !== "SYSTEM_OWNER") {
    throw new Error("Not authorized.");
  }

  const id = String(formData.get("id") || "");

  await prisma.fiscalYear.update({
    where: { id },
    data: {
      status: "CLOSED",
      closedAt: new Date(),
      closedBy: admin.id,
    },
  });

  await writeAudit({
    eventType: "FINANCIAL_CHANGES",
    actorId: admin.id,
    details: `Closed Fiscal Year entry configuration ID: ${id}`,
  });

  revalidatePath("/admin/settings");
}

export async function updateApproverConfigAction(formData: FormData) {
  const admin = await requireUser();

  if (admin.role !== "SYSTEM_OWNER") {
    throw new Error("Not authorized.");
  }

  const id = String(formData.get("id") || "");
  const primaryApproverId = String(
    formData.get("primaryApproverId") || ""
  );
  const backupApproverId =
    String(formData.get("backupApproverId") || "") || null;
  const delegationActive =
    formData.get("delegationActive") === "on";

  await prisma.approverConfig.update({
    where: { id },
    data: {
      primaryApproverId,
      backupApproverId,
      delegationActive,
    },
  });

  await writeAudit({
    eventType: "ACCESS_ADMIN",
    actorId: admin.id,
    details: `Updated configuration values for Approver Registry Map ID: ${id}`,
  });

  revalidatePath("/admin/approvers");
}

// ---------- User Self-Service ----------
export async function changeOwnPasswordAction(formData: FormData) {
  const user = await requireUser();
  const currentPassword = String(formData.get("currentPassword") || "");
  const newPassword = String(formData.get("newPassword") || "");

  if (!currentPassword || !newPassword) {
    throw new Error("Both current and new passwords are required.");
  }
  if (newPassword.length < 8) {
    throw new Error("New password must be at least 8 characters long.");
  }

  // Fetch current user record securely from database
  const dbUser = await prisma.user.findUniqueOrThrow({
    where: { id: user.id }
  });

  // Verify old password hash
  const isValid = await bcrypt.compare(currentPassword, dbUser.passwordHash);
  if (!isValid) {
    throw new Error("The current password you entered is incorrect.");
  }

  // Hash and save new password
  const newPasswordHash = await bcrypt.hash(newPassword, 10);
  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash: newPasswordHash },
  });

  await writeAudit({ 
    eventType: "ACCESS_ADMIN", 
    actorId: user.id, 
    details: "User updated their own account password" 
  });
  
  revalidatePath("/accounts");
}

