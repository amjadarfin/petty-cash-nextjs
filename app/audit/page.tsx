import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function AuditPage() {
  const logs = await prisma.auditLog.findMany({
    orderBy: { timestamp: "desc" },
    take: 300,
    include: { actor: true },
  });

  return (
    <div>
      <h2 style={{ fontSize: 24, color: "var(--heading)", margin: "0 0 4px" }}>Audit Trail</h2>
      <p style={{ color: "var(--slate)", margin: "0 0 22px", fontSize: 13 }}>
        Every material action, time-stamped and attributable. Read-only. Showing the most recent 300 entries.
      </p>

      {logs.length === 0 ? (
        <div className="empty">No events recorded yet.</div>
      ) : (
        <table>
          <thead><tr><th>When</th><th>Event</th><th>Voucher</th><th>Actor</th><th>Detail</th></tr></thead>
          <tbody>
            {logs.map((a) => (
              <tr key={a.id}>
                <td>{new Date(a.timestamp).toLocaleString("en-GB")}</td>
                <td>{a.eventType.replace(/_/g, " ")}</td>
                <td className="voucher">{a.voucherNo || "—"}</td>
                <td>{a.actor?.name || "System"}</td>
                <td>{a.details}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
