import { prisma } from "@/lib/prisma";
import { money } from "@/lib/pettycash";
import { markSettledAction } from "@/lib/actions";

export const dynamic = "force-dynamic";

export default async function OpenPaymentsPage() {
  const list = await prisma.request.findMany({ where: { status: "PAID" }, include: { requester: true } });

  async function settle(formData: FormData) {
    "use server";
    await markSettledAction(String(formData.get("requestId")));
  }

  return (
    <div>
      <h2 style={{ fontSize: 24, color: "var(--heading)", margin: "0 0 4px" }}>Open Payments</h2>
      <p style={{ color: "var(--slate)", margin: "0 0 22px", fontSize: 13 }}>Paid but not yet settled / reconciled.</p>

      {list.length === 0 ? (
        <div className="empty">No open (unsettled) payments.</div>
      ) : (
        <table>
          <thead><tr><th>Voucher</th><th>Requester</th><th>Amount</th><th></th></tr></thead>
          <tbody>
            {list.map((r) => (
              <tr key={r.id}>
                <td className="voucher">{r.voucherNo}</td>
                <td>{r.requester.name}</td>
                <td>{money(Number(r.requestedAmount))}</td>
                <td>
                  <form action={settle}>
                    <input type="hidden" name="requestId" value={r.id} />
                    <button className="btn btn-outline btn-small" type="submit">Mark Settled</button>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
