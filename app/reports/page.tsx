import { prisma } from "@/lib/prisma";
import {
  activeFiscalYear,
  totalAllocation,
  approvedExpenditure,
  paidExpenditure,
  pendingCommitment,
  budgetHeadSpent,
  money,
} from "@/lib/pettycash";

export const dynamic = "force-dynamic";

export default async function ReportsPage() {
  const fy = await activeFiscalYear();
  const [total, approved, paid, pending, budgetHeads] = await Promise.all([
    totalAllocation(fy.id),
    approvedExpenditure(fy.id),
    paidExpenditure(fy.id),
    pendingCommitment(fy.id),
    prisma.budgetHead.findMany(),
  ]);

  const rows = await Promise.all(
    budgetHeads.map(async (bh) => {
      const spent = await budgetHeadSpent(bh.id, fy.id);
      const pct = Number(bh.annualLimit) > 0 ? Math.round((spent / Number(bh.annualLimit)) * 100) : 0;
      return { ...bh, spent, pct };
    })
  );

  const exceptions = await prisma.request.findMany({
    where: {
      OR: [{ evidenceStatus: "EXCEPTION_REQUESTED" }, { status: { in: ["REJECTED_BY_DD", "REJECTED_BY_DIRECTOR"] } }],
    },
    include: { requester: true },
  });

  return (
    <div>
      <h2 style={{ fontSize: 24, color: "var(--heading)", margin: "0 0 4px" }}>Reports</h2>
      <p style={{ color: "var(--slate)", margin: "0 0 22px", fontSize: 13 }}>Fiscal-year summary and category breakdown for {fy.name}.</p>

      <div className="grid grid-cols-4 gap-4">
        <Kpi label="Allocation" value={money(total)} />
        <Kpi label="Approved" value={money(approved)} />
        <Kpi label="Paid" value={money(paid)} />
        <Kpi label="Pending" value={money(pending)} />
      </div>

      <h3 style={{ color: "var(--heading)", marginTop: 24 }}>Budget Head Utilization</h3>
      <table>
        <thead><tr><th>Code</th><th>Budget Head</th><th>Annual Limit</th><th>Approved Spend</th><th>Consumption %</th><th>Threshold</th></tr></thead>
        <tbody>
          {rows.map((bh) => (
            <tr key={bh.id}>
              <td>{bh.code}</td>
              <td>{bh.name}</td>
              <td>{money(Number(bh.annualLimit))}</td>
              <td>{money(bh.spent)}</td>
              <td>{bh.pct}%</td>
              <td>{bh.pct >= bh.thresholdPercent ? <span style={{ color: "var(--gold)", fontWeight: 700 }}>NEAR LIMIT</span> : "OK"}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h3 style={{ color: "var(--heading)", marginTop: 24 }}>Exceptions</h3>
      {exceptions.length === 0 ? (
        <div className="empty">No exceptions.</div>
      ) : (
        <table>
          <thead><tr><th>Voucher</th><th>Requester</th><th>Issue</th></tr></thead>
          <tbody>
            {exceptions.map((r) => (
              <tr key={r.id}>
                <td className="voucher">{r.voucherNo || "DRAFT"}</td>
                <td>{r.requester.name}</td>
                <td>{r.evidenceStatus === "EXCEPTION_REQUESTED" ? `Evidence exception: ${r.exceptionReason || "—"}` : `Rejected — ${r.status.replace(/_/g, " ")}`}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <div className="card">
      <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: 0.5, color: "var(--slate)", fontWeight: 700 }}>{label}</div>
      <div style={{ fontSize: 20, marginTop: 6, color: "var(--heading)", fontFamily: "Georgia, serif" }}>{value}</div>
    </div>
  );
}
