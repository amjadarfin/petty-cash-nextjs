import { prisma } from "@/lib/prisma";
import { money } from "@/lib/pettycash";

export const dynamic = "force-dynamic";

export default async function RegisterPage() {
  const list = await prisma.request.findMany({
    where: { status: { in: ["FINALLY_APPROVED", "PAID", "SETTLED"] } },
    include: { requester: true, budgetHead: true },
    orderBy: { directorDecisionDate: "desc" },
  });

  return (
    <div>
      <h2 style={{ fontSize: 24, color: "var(--heading)", margin: "0 0 4px" }}>Petty Cash Register</h2>
      <p style={{ color: "var(--slate)", margin: "0 0 22px", fontSize: 13 }}>Finally approved, paid and settled transactions.</p>

      {list.length === 0 ? (
        <div className="empty">No approved transactions yet.</div>
      ) : (
        <table>
          <thead>
            <tr><th>Voucher</th><th>Date</th><th>Requester</th><th>Vendor</th><th>Budget Head</th><th>Amount</th><th>Payment Status</th><th>Status</th></tr>
          </thead>
          <tbody>
            {list.map((r) => (
              <tr key={r.id}>
                <td className="voucher">{r.voucherNo}</td>
                <td>{new Date(r.expenseDate).toLocaleDateString("en-GB")}</td>
                <td>{r.requester.name}</td>
                <td>{r.vendorPayee}</td>
                <td>{r.budgetHead?.name || "—"}</td>
                <td>{money(Number(r.requestedAmount))}</td>
                <td>{r.paymentStatus.replace(/_/g, " ")}</td>
                <td><span className={`status-pill st-${r.status}`}>{r.status.replace(/_/g, " ")}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
