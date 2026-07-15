import { prisma } from "@/lib/prisma";
//import { updateApproverConfigAction } from "@/lib/actions";

export const dynamic = "force-dynamic";

export default async function ApproversAdminPage() {
  const [users, configs] = await Promise.all([
    prisma.user.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
    prisma.approverConfig.findMany(),
  ]);

  const ddConfig = configs.find((c) => c.roleName === "DEPUTY_DIRECTOR");
  const dirConfig = configs.find((c) => c.roleName === "DIRECTOR");

  return (
    <div>
      <h2 style={{ fontSize: 24, color: "var(--heading)", margin: "0 0 4px" }}>Approver Configuration &amp; Delegation</h2>
      <p style={{ color: "var(--slate)", margin: "0 0 22px", fontSize: 13 }}>
        Set the primary approver for each stage, and optionally activate a backup approver for a date range
        (e.g. while the Deputy Director is on leave). Requests route to the primary approver unless a delegation
        window is active and today falls inside it.
      </p>

      <div className="grid grid-cols-2 gap-4">
        <ApproverCard roleName="DEPUTY_DIRECTOR" label="Deputy Director" config={ddConfig} users={users} />
        <ApproverCard roleName="DIRECTOR" label="Director" config={dirConfig} users={users} />
      </div>
    </div>
  );
}

function ApproverCard({
  roleName,
  label,
  config,
  users,
}: {
  roleName: "DEPUTY_DIRECTOR" | "DIRECTOR";
  label: string;
  config?: { primaryApproverId: string; backupApproverId: string | null; delegationActive: boolean; delegationStart: Date | null; delegationEnd: Date | null };
  users: { id: string; name: string; role: string }[];
}) {
  const toInputDate = (d: Date | null | undefined) => (d ? new Date(d).toISOString().slice(0, 10) : "");

  return (
    <div className="card">
      <h3 style={{ marginTop: 0, color: "var(--heading)" }}>{label}</h3>
      {/*
      <form action={updateApproverConfigAction}>
        <input type="hidden" name="roleName" value={roleName} />
        <div className="mb-3">
          <label>Primary Approver</label>
          <select name="primaryApproverId" defaultValue={config?.primaryApproverId || ""} required>
            <option value="" disabled>Select a person</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>{u.name} ({u.role.replace(/_/g, " ")})</option>
            ))}
          </select>
        </div>
        <div className="mb-3">
          <label>Backup Approver (optional)</label>
          <select name="backupApproverId" defaultValue={config?.backupApproverId || ""}>
            <option value="">None</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>{u.name} ({u.role.replace(/_/g, " ")})</option>
            ))}
          </select>
        </div>
        <label style={{ textTransform: "none", fontWeight: 400, display: "flex", alignItems: "center", gap: 6, marginBottom: 12 }}>
          <input type="checkbox" name="delegationActive" defaultChecked={config?.delegationActive} style={{ width: "auto" }} />
          Delegation active (route to backup approver during the dates below)
        </label>
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div>
            <label>Delegation Start</label>
            <input type="date" name="delegationStart" defaultValue={toInputDate(config?.delegationStart)} />
          </div>
          <div>
            <label>Delegation End</label>
            <input type="date" name="delegationEnd" defaultValue={toInputDate(config?.delegationEnd)} />
          </div>
        </div>
        <button className="btn btn-gold btn-small" type="submit">Save</button>
      </form>
      */}
    </div>
  );
}
