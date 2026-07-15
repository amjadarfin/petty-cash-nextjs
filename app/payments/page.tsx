import { prisma } from "@/lib/prisma";
import { money } from "@/lib/pettycash";
import { recordPaymentAction } from "@/lib/actions";

export const dynamic = "force-dynamic";

export default async function PaymentsPage() {
  const list = await prisma.request.findMany({
    where: { status: "FINALLY_APPROVED" },
    include: { requester: true, payments: true },
    orderBy: { directorDecisionDate: "asc" },
  });

  return (
    <div>
      <h2 style={{ fontSize: 24, color: "var(--heading)", margin: "0 0 4px" }}>Approved — Awaiting Payment</h2>
      <p style={{ color: "var(--slate)", margin: "0 0 22px", fontSize: 13 }}>Record disbursement details for finally approved requests.</p>

      {list.length === 0 ? (
        <div className="empty">Nothing awaiting payment right now.</div>
      ) : (
        <div className="flex flex-col gap-4">
          {list.map((r) => {
            const paidSoFar = r.payments.reduce((s, p) => s + Number(p.paidAmount), 0);
            const remaining = Number(r.requestedAmount) - paidSoFar;
            const today = new Date().toISOString().slice(0, 10);
            return (
              <div key={r.id} className="card">
                <div className="flex justify-between flex-wrap gap-2 mb-2">
                  <div>
                    <span className="voucher">{r.voucherNo}</span> &middot; {r.requester.name} &middot; {r.vendorPayee}
                  </div>
                  <div style={{ color: "var(--slate)", fontSize: 12.5 }}>
                    Approved: {money(Number(r.requestedAmount))} &middot; Remaining: {money(remaining)}
                  </div>
                </div>
                <form action={recordPaymentAction}>
                  <input type="hidden" name="requestId" value={r.id} />
                  <div className="grid grid-cols-4 gap-3 items-end">
                    <div>
                      <label>Amount Paid</label>
                      <input type="number" name="paidAmount" max={remaining} defaultValue={remaining} />
                    </div>
                    <div>
                      <label>Payment Date</label>
                      <input type="date" name="paymentDate" defaultValue={today} />
                    </div>
                    <div>
                      <label>Method</label>
                      <select name="method">
                        <option>Cash</option>
                        <option>Bank Transfer</option>
                        <option>Reimbursement</option>
                        <option>Other</option>
                      </select>
                    </div>
                    <div>
                      <label>Reference</label>
                      <input type="text" name="reference" placeholder="Cheque / txn ref" />
                    </div>
                  </div>
                  <label className="flex items-center gap-2 mt-3" style={{ textTransform: "none", fontWeight: 400 }}>
                    <input type="checkbox" name="settled" style={{ width: "auto" }} /> Mark as Settled (reconciliation complete)
                  </label>
                  <button className="btn btn-gold btn-small mt-3" type="submit">Save Payment</button>
                </form>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
