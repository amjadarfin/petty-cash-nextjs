import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { money } from "@/lib/pettycash";

export const dynamic = "force-dynamic";

export default async function PendingDirectorPage() {
  const pending = await prisma.request.findMany({
    where: { status: "APPROVED_BY_DD" },
    include: { requester: true },
    orderBy: { ddDecisionDate: "asc" },
  });

  return (
    <div>
      <h2 style={{ fontSize: 24, color: "var(--heading)", margin: "0 0 4px" }}>Pending Director Final Approval</h2>
      <p style={{ color: "var(--slate)", margin: "0 0 22px", fontSize: 13 }}>Final approval locks the record and releases it to Accounts.</p>

      {pending.length === 0 ? (
        <div className="empty">No requests awaiting final approval.</div>
      ) : (
        <table>
          <thead><tr><th>Voucher</th><th>Requester</th><th>Vendor</th><th>Amount</th><th>DD Approved</th><th></th></tr></thead>
          <tbody>
            {pending.map((r) => (
              <tr key={r.id}>
                <td className="voucher">{r.voucherNo}</td>
                <td>{r.requester.name}</td>
                <td>{r.vendorPayee}</td>
                <td>{money(Number(r.requestedAmount))}</td>
                <td>{r.ddDecisionDate ? new Date(r.ddDecisionDate).toLocaleDateString("en-GB") : "—"}</td>
                <td><Link className="btn btn-gold btn-small" href={`/requests/${r.id}`}>Review</Link></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
