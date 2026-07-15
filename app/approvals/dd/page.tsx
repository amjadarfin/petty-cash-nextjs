import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { money } from "@/lib/pettycash";

export const dynamic = "force-dynamic";

export default async function PendingDDPage() {
  const pending = await prisma.request.findMany({
    where: { status: "SUBMITTED" },
    include: { requester: true },
    orderBy: { requestDate: "asc" },
  });

  return (
    <div>
      <h2 style={{ fontSize: 24, color: "var(--heading)", margin: "0 0 4px" }}>Pending Deputy Director Approval</h2>
      <p style={{ color: "var(--slate)", margin: "0 0 22px", fontSize: 13 }}>Verify need, evidence, budget head and amount.</p>

      {pending.length === 0 ? (
        <div className="empty">No requests awaiting your review.</div>
      ) : (
        <table>
          <thead><tr><th>Voucher</th><th>Requester</th><th>Vendor</th><th>Amount</th><th>Submitted</th><th></th></tr></thead>
          <tbody>
            {pending.map((r) => (
              <tr key={r.id}>
                <td className="voucher">{r.voucherNo}</td>
                <td>{r.requester.name}</td>
                <td>{r.vendorPayee}</td>
                <td>{money(Number(r.requestedAmount))}</td>
                <td>{r.requestDate ? new Date(r.requestDate).toLocaleDateString("en-GB") : "—"}</td>
                <td><Link className="btn btn-gold btn-small" href={`/requests/${r.id}`}>Review</Link></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
