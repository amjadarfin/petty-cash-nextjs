import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { money } from "@/lib/pettycash";

export const dynamic = "force-dynamic";

export default async function MyRequestsPage() {
  const session = await auth();
  const mine = await prisma.request.findMany({
    where: { requesterId: session!.user.id },
    include: { budgetHead: true },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div>
      <h2 style={{ fontSize: 24, color: "var(--heading)", margin: "0 0 4px" }}>My Requests</h2>
      <p style={{ color: "var(--slate)", margin: "0 0 22px", fontSize: 13 }}>Drafts, submissions and their current status.</p>

      {mine.length === 0 ? (
        <div className="empty">You have not created any requests yet. Use &quot;New Request&quot; to begin.</div>
      ) : (
        <table>
          <thead>
            <tr><th>Voucher</th><th>Date</th><th>Vendor</th><th>Budget Head</th><th>Amount</th><th>Status</th><th></th></tr>
          </thead>
          <tbody>
            {mine.map((r) => (
              <tr key={r.id}>
                <td className="voucher">{r.voucherNo || "DRAFT"}</td>
                <td>{new Date(r.expenseDate).toLocaleDateString("en-GB")}</td>
                <td>{r.vendorPayee}</td>
                <td>{r.budgetHead?.name || "—"}</td>
                <td>{money(Number(r.requestedAmount))}</td>
                <td><span className={`status-pill st-${r.status}`}>{r.status.replace(/_/g, " ")}</span></td>
                <td><Link className="btn btn-outline btn-small" href={`/requests/${r.id}`}>View</Link></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
