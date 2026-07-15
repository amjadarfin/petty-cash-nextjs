import { prisma } from "@/lib/prisma";
import { activeFiscalYear } from "@/lib/pettycash";
import { submitRequestAction } from "@/lib/actions";

export const dynamic = "force-dynamic";

export default async function NewRequestPage() {
  const fy = await activeFiscalYear();
  const budgetHeads = await prisma.budgetHead.findMany({ where: { active: true }, orderBy: { sortOrder: "asc" } });
  const today = new Date().toISOString().slice(0, 10);

  return (
    <div>
      <h2 style={{ fontSize: 24, color: "var(--heading)", margin: "0 0 4px" }}>New Expense Request</h2>
      <p style={{ color: "var(--slate)", margin: "0 0 22px", fontSize: 13 }}>Submit a petty cash request against {fy.name}.</p>

      <form action={submitRequestAction} className="card" style={{ maxWidth: 640 }}>
        <div className="grid grid-cols-2 gap-4 mb-3">
          <div>
            <label>Expense Date</label>
            <input type="date" name="expenseDate" defaultValue={today} required />
          </div>
          <div>
            <label>Vendor / Payee</label>
            <input type="text" name="vendorPayee" placeholder="e.g. City Stationers" />
          </div>
        </div>
        <div className="mb-3">
          <label>Purpose</label>
          <textarea name="purpose" rows={3} placeholder="Describe the expense..." />
        </div>
        <div className="grid grid-cols-2 gap-4 mb-3">
          <div>
            <label>Budget Head</label>
            <select name="budgetHeadId">
              {budgetHeads.map((b) => (
                <option key={b.id} value={b.id}>{b.name} ({b.code})</option>
              ))}
            </select>
          </div>
          <div>
            <label>Amount (PKR)</label>
            <input type="number" name="requestedAmount" min={1} placeholder="0" />
          </div>
        </div>
        <div className="mb-3">
          <label>Receipt / Evidence (PDF, JPG, PNG, HEIC, DOCX, XLSX — max 25MB)</label>
          <input type="file" name="evidence" accept=".pdf,.jpg,.jpeg,.png,.heic,.docx,.xlsx" />
        </div>
        <div className="mb-4">
          <label>If evidence is unavailable, state exception reason (optional)</label>
          <input type="text" name="exceptionReason" placeholder="Leave blank if receipt attached" />
        </div>
        <div className="flex gap-2 flex-wrap">
          <button className="btn btn-outline" name="intent" value="draft" formNoValidate type="submit">Save as Draft</button>
          <button className="btn btn-gold" name="intent" value="submit" type="submit">Submit for Approval</button>
        </div>
      </form>
    </div>
  );
}
