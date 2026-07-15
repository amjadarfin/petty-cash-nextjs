import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { money, availableBalance } from "@/lib/pettycash";
import { resubmitRequestAction, decideDDAction, decideDirectorAction } from "@/lib/actions";
import { notFound, redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function RequestDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  const req = await prisma.request.findUnique({
    where: { id },
    include: { budgetHead: true, fiscalYear: true, requester: true, approvalActions: { include: { actor: true }, orderBy: { actionDate: "asc" } } },
  });
  if (!req) notFound();

  const role = session!.user.role;
  const isOwner = req.requesterId === session!.user.id;
  const canEdit = isOwner && ["DRAFT", "RETURNED_BY_DD", "RETURNED_BY_DIRECTOR"].includes(req.status);
  const canReviewDD = role === "DEPUTY_DIRECTOR" && req.status === "SUBMITTED";
  const canReviewDirector = role === "DIRECTOR" && req.status === "APPROVED_BY_DD";

  let availableBal = 0;
  if (canReviewDirector) availableBal = await availableBalance(req.fiscalYearId);

  async function resubmit(formData: FormData) {
    "use server";
    await resubmitRequestAction(id, formData);
  }
  async function ddDecision(formData: FormData) {
    "use server";
    await decideDDAction(id, formData.get("decision") as "Approve" | "Return" | "Reject", String(formData.get("comments") || ""));
    redirect("/approvals/dd");
  }
  async function directorDecision(formData: FormData) {
    "use server";
    await decideDirectorAction(id, formData.get("decision") as "FinalApprove" | "Return" | "Reject", String(formData.get("comments") || ""));
    redirect("/approvals/director");
  }

  return (
    <div>
      <h2 style={{ fontSize: 24, color: "var(--heading)", margin: "0 0 4px" }}>
        {req.voucherNo || "Draft Request"}
      </h2>
      <p style={{ color: "var(--slate)", margin: "0 0 22px", fontSize: 13 }}>
        <span className={`status-pill st-${req.status}`}>{req.status.replace(/_/g, " ")}</span>
      </p>

      <div className="card" style={{ maxWidth: 700 }}>
        <Detail label="Requester" value={`${req.requester.name} (${req.department || "—"})`} />
        <Detail label="Fiscal Year" value={req.fiscalYear.name} />
        <Detail label="Expense Date" value={new Date(req.expenseDate).toLocaleDateString("en-GB")} />
        <Detail label="Vendor / Payee" value={req.vendorPayee} />
        <Detail label="Purpose" value={req.purpose} />
        <Detail label="Budget Head" value={req.budgetHead?.name || "—"} />
        <Detail label="Requested Amount" value={money(Number(req.requestedAmount))} />
        <Detail
          label="Evidence"
          value={req.evidencePath ? (
            <a href={`/api/evidence/${req.evidencePath}`} target="_blank" style={{ color: "var(--heading)", textDecoration: "underline" }}>
              {req.evidenceFileName}
            </a>
          ) : req.exceptionReason ? `Exception: ${req.exceptionReason}` : "None"}
        />
        {req.budgetThresholdFlag && (
          <Detail label="Budget Warning" value={<span style={{ color: "var(--gold)", fontWeight: 700 }}>This request pushes its budget head at/above threshold.</span>} />
        )}
      </div>

      <h3 style={{ color: "var(--heading)", marginTop: 22 }}>Approval History</h3>
      {req.approvalActions.length === 0 ? (
        <div className="empty">No approval actions yet.</div>
      ) : (
        <table>
          <thead><tr><th>Stage</th><th>Decision</th><th>Actor</th><th>When</th><th>Comments</th></tr></thead>
          <tbody>
            {req.approvalActions.map((a) => (
              <tr key={a.id}>
                <td>{a.stage.replace(/_/g, " ")}</td>
                <td>{a.decision}</td>
                <td>{a.actor.name}</td>
                <td>{new Date(a.actionDate).toLocaleString("en-GB")}</td>
                <td>{a.comments}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {canEdit && (
        <div className="card mt-5" style={{ maxWidth: 700 }}>
          <h3 style={{ color: "var(--heading)", marginTop: 0 }}>Edit &amp; {req.status === "DRAFT" ? "Submit" : "Resubmit"}</h3>
          <form action={resubmit}>
            <div className="grid grid-cols-2 gap-4 mb-3">
              <div>
                <label>Expense Date</label>
                <input type="date" name="expenseDate" defaultValue={new Date(req.expenseDate).toISOString().slice(0, 10)} required />
              </div>
              <div>
                <label>Vendor / Payee</label>
                <input type="text" name="vendorPayee" defaultValue={req.vendorPayee} />
              </div>
            </div>
            <div className="mb-3">
              <label>Purpose</label>
              <textarea name="purpose" defaultValue={req.purpose} rows={3} />
            </div>
            <div className="grid grid-cols-2 gap-4 mb-3">
              <div>
                <label>Budget Head</label>
                <select name="budgetHeadId" defaultValue={req.budgetHeadId}>
                  <BudgetHeadOptions />
                </select>
              </div>
              <div>
                <label>Amount (PKR)</label>
                <input type="number" name="requestedAmount" defaultValue={Number(req.requestedAmount)} min={1} />
              </div>
            </div>
            <div className="mb-3">
              <label>Replace Receipt / Evidence (optional)</label>
              <input type="file" name="evidence" accept=".pdf,.jpg,.jpeg,.png,.heic,.docx,.xlsx" />
            </div>
            <div className="mb-4">
              <label>Exception reason (optional)</label>
              <input type="text" name="exceptionReason" defaultValue={req.exceptionReason || ""} />
            </div>
            <div className="flex gap-2">
              <button className="btn btn-outline" name="intent" value="draft" formNoValidate type="submit">Save as Draft</button>
              <button className="btn btn-gold" name="intent" value="submit" type="submit">
                {req.status === "DRAFT" ? "Submit for Approval" : "Resubmit for Approval"}
              </button>
            </div>
          </form>
        </div>
      )}

      {canReviewDD && (
        <div className="card mt-5" style={{ maxWidth: 700 }}>
          <h3 style={{ color: "var(--heading)", marginTop: 0 }}>Review — Deputy Director</h3>
          <form action={ddDecision}>
            <div className="mb-3">
              <label>Comments (required)</label>
              <textarea name="comments" rows={3} required placeholder="Enter your remarks..." />
            </div>
            <div className="flex gap-2 flex-wrap">
              <button className="btn btn-green" name="decision" value="Approve" type="submit">Approve</button>
              <button className="btn btn-outline" name="decision" value="Return" type="submit">Return</button>
              <button className="btn btn-red" name="decision" value="Reject" type="submit">Reject</button>
            </div>
          </form>
        </div>
      )}

      {canReviewDirector && (
        <div className="card mt-5" style={{ maxWidth: 700 }}>
          <h3 style={{ color: "var(--heading)", marginTop: 0 }}>Review — Director Final Approval</h3>
          <div className="banner banner-info">Available balance before this decision: <strong>{money(availableBal)}</strong></div>
          {Number(req.requestedAmount) > availableBal && (
            <div className="banner banner-err">Final approval is BLOCKED: this amount exceeds the authorized available balance.</div>
          )}
          <form action={directorDecision}>
            <div className="mb-3">
              <label>Comments (required)</label>
              <textarea name="comments" rows={3} required placeholder="Enter your remarks..." />
            </div>
            <div className="flex gap-2 flex-wrap">
              <button className="btn btn-green" name="decision" value="FinalApprove" type="submit" disabled={Number(req.requestedAmount) > availableBal}>
                Final Approve
              </button>
              <button className="btn btn-outline" name="decision" value="Return" type="submit">Return</button>
              <button className="btn btn-red" name="decision" value="Reject" type="submit">Reject</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

function Detail({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div style={{ marginTop: 10 }}>
      <div style={{ fontSize: 11, textTransform: "uppercase", color: "var(--slate)", letterSpacing: 0.4 }}>{label}</div>
      <div style={{ fontSize: 13.5, marginTop: 2 }}>{value}</div>
    </div>
  );
}

async function BudgetHeadOptions() {
  const heads = await prisma.budgetHead.findMany({ where: { active: true }, orderBy: { sortOrder: "asc" } });
  return (
    <>
      {heads.map((b) => (
        <option key={b.id} value={b.id}>{b.name} ({b.code})</option>
      ))}
    </>
  );
}
