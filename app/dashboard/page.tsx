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

export default async function DashboardPage() {
  const fy = await activeFiscalYear();
  const [total, approved, paid, pending, budgetHeads, recentAudit] = await Promise.all([
    totalAllocation(fy.id),
    approvedExpenditure(fy.id),
    paidExpenditure(fy.id),
    pendingCommitment(fy.id),
    prisma.budgetHead.findMany({ where: { active: true } }),
    prisma.auditLog.findMany({ orderBy: { timestamp: "desc" }, take: 8, include: { actor: true } }),
  ]);
  const available = total - approved;

  const utilization = await Promise.all(
    budgetHeads.map(async (bh) => {
      const spent = await budgetHeadSpent(bh.id, fy.id);
      const pct = Number(bh.annualLimit) > 0 ? Math.round((spent / Number(bh.annualLimit)) * 100) : 0;
      return { ...bh, spent, pct };
    })
  );

  return (
    <div>
      <h2 style={{ fontSize: 24, color: "var(--heading)", margin: "0 0 4px" }}>Dashboard</h2>
      <p style={{ color: "var(--slate)", margin: "0 0 22px", fontSize: 13 }}>
        {fy.name} ({new Date(fy.startDate).toLocaleDateString("en-GB")} – {new Date(fy.endDate).toLocaleDateString("en-GB")}) &middot; Status: {fy.status}
      </p>

      <div className="grid grid-cols-4 gap-4">
        <Kpi label="Total Allocation" value={money(total)} />
        <Kpi label="Approved Expenditure" value={money(approved)} />
        <Kpi label="Paid Expenditure" value={money(paid)} />
        <Kpi label="Available Balance" value={money(available)} color={available < 0 ? "var(--red)" : "var(--green)"} foot={`Pending commitments: ${money(pending)}`} />
      </div>

      <h3 style={{ color: "var(--heading)", marginTop: 26 }}>Budget Head Utilization</h3>
      <div className="grid grid-cols-2 gap-4">
        {utilization.map((bh) => (
          <div key={bh.id} className="card">
            <div className="flex justify-between text-sm">
              <strong>{bh.name}</strong>
              <span style={{ color: "var(--slate)" }}>{money(bh.spent)} / {money(Number(bh.annualLimit))}</span>
            </div>
            <div style={{ background: "var(--line)", borderRadius: 6, height: 8, overflow: "hidden", marginTop: 8 }}>
              <div
                style={{
                  height: "100%",
                  width: `${Math.min(bh.pct, 100)}%`,
                  background: bh.pct >= 100 ? "var(--red)" : bh.pct >= bh.thresholdPercent ? "var(--gold)" : "var(--green)",
                }}
              />
            </div>
            <div style={{ fontSize: 11, marginTop: 5, color: "var(--slate)" }}>
              {bh.pct}% consumed &middot; threshold {bh.thresholdPercent}%
              {bh.pct >= bh.thresholdPercent && <span style={{ color: "var(--gold)", fontWeight: 700 }}> — NEAR LIMIT</span>}
            </div>
          </div>
        ))}
      </div>

      <h3 style={{ color: "var(--heading)", marginTop: 26 }}>Recent Activity</h3>
      {recentAudit.length === 0 ? (
        <div className="empty">No activity yet.</div>
      ) : (
        <table>
          <thead>
            <tr><th>When</th><th>Event</th><th>Voucher</th><th>Actor</th><th>Detail</th></tr>
          </thead>
          <tbody>
            {recentAudit.map((a) => (
              <tr key={a.id}>
                <td>{new Date(a.timestamp).toLocaleString("en-GB")}</td>
                <td>{a.eventType.replace(/_/g, " ")}</td>
                <td className="voucher">{a.voucherNo || "—"}</td>
                <td>{a.actor?.name || "—"}</td>
                <td>{a.details}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

function Kpi({ label, value, color, foot }: { label: string; value: string; color?: string; foot?: string }) {
  return (
    <div className="card">
      <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: 0.5, color: "var(--slate)", fontWeight: 700 }}>{label}</div>
      <div style={{ fontSize: 26, marginTop: 6, color: color || "var(--navy)", fontFamily: "Georgia, serif" }}>{value}</div>
      {foot && <div style={{ fontSize: 11, color: "var(--slate)", marginTop: 4 }}>{foot}</div>}
    </div>
  );
}
