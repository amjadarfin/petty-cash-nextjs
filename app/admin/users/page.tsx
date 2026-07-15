import { prisma } from "@/lib/prisma";
import { createUserAction, toggleUserActiveAction, resetUserPasswordAction } from "@/lib/actions";

export const dynamic = "force-dynamic";

const ROLE_OPTIONS = ["STAFF", "DEPUTY_DIRECTOR", "DIRECTOR", "ACCOUNTS", "SYSTEM_OWNER"];

export default async function UsersAdminPage() {
  const users = await prisma.user.findMany({ orderBy: { createdAt: "asc" } });

  return (
    <div>
      <h2 style={{ fontSize: 24, color: "var(--heading)", margin: "0 0 4px" }}>User Management</h2>
      <p style={{ color: "var(--slate)", margin: "0 0 22px", fontSize: 13 }}>
        Create staff accounts, deactivate departures, and reset forgotten passwords.
      </p>

      <table>
        <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Department</th><th>Active</th><th>Reset Password</th></tr></thead>
        <tbody>
          {users.map((u) => (
            <tr key={u.id}>
              <td>{u.name}</td>
              <td>{u.email}</td>
              <td>{u.role.replace(/_/g, " ")}</td>
              <td>{u.department || "—"}</td>
              <td>
                <form action={toggleUserActiveAction} className="flex items-center gap-2">
                  <input type="hidden" name="id" value={u.id} />
                  <label style={{ textTransform: "none", fontWeight: 400, display: "inline-flex", alignItems: "center", gap: 6 }}>
                    <input type="checkbox" name="active" defaultChecked={u.active} style={{ width: "auto" }} />
                    {u.active ? "Active" : "Inactive"}
                  </label>
                  <button className="btn btn-outline btn-small" type="submit">Save</button>
                </form>
              </td>
              <td>
                <details>
                  <summary style={{ cursor: "pointer", color: "var(--gold)", fontSize: 12 }}>Reset...</summary>
                  <form action={resetUserPasswordAction} className="mt-2 flex gap-2 items-center flex-wrap">
                    <input type="hidden" name="id" value={u.id} />
                    <input type="password" name="newPassword" placeholder="New password (min 8 chars)" minLength={8} required style={{ width: 200 }} />
                    <button className="btn btn-outline btn-small" type="submit">Set Password</button>
                  </form>
                </details>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="card mt-5" style={{ maxWidth: 500 }}>
        <h3 style={{ marginTop: 0, color: "var(--heading)" }}>Add Staff Account</h3>
        <form action={createUserAction}>
          <div className="mb-3">
            <label>Full Name</label>
            <input type="text" name="name" required />
          </div>
          <div className="mb-3">
            <label>Email</label>
            <input type="email" name="email" required />
          </div>
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div>
              <label>Role</label>
              <select name="role" defaultValue="STAFF">
                {ROLE_OPTIONS.map((r) => (
                  <option key={r} value={r}>{r.replace(/_/g, " ")}</option>
                ))}
              </select>
            </div>
            <div>
              <label>Department</label>
              <input type="text" name="department" />
            </div>
          </div>
          <div className="mb-4">
            <label>Initial Password (min 8 characters — share with the user privately)</label>
            <input type="password" name="password" required minLength={8} />
          </div>
          <button className="btn btn-gold" type="submit">Create Account</button>
        </form>
      </div>
    </div>
  );
}
