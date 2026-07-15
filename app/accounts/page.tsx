import { auth } from "@/lib/auth";
import { changeOwnPasswordAction } from "@/lib/actions";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function AccountPage({ searchParams }: { searchParams: Promise<{ error?: string; ok?: string }> }) {
  const session = await auth();
  const params = await searchParams;

  async function changePassword(formData: FormData) {
    "use server";
    try {
      await changeOwnPasswordAction(formData);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not change password.";
      redirect(`/account?error=${encodeURIComponent(message)}`);
    }
    redirect("/account?ok=1");
  }

  return (
    <div>
      <h2 style={{ fontSize: 24, color: "var(--heading)", margin: "0 0 4px" }}>My Account</h2>
      <p style={{ color: "var(--slate)", margin: "0 0 22px", fontSize: 13 }}>
        Signed in as {session?.user?.name} ({session?.user?.email})
      </p>

      <div className="card" style={{ maxWidth: 460 }}>
        <h3 style={{ marginTop: 0, color: "var(--heading)" }}>Change Password</h3>
        {params.error && <div className="banner banner-err">{params.error}</div>}
        {params.ok && <div className="banner banner-info">Password updated successfully.</div>}
        <form action={changePassword}>
          <div className="mb-3">
            <label>Current Password</label>
            <input type="password" name="currentPassword" required />
          </div>
          <div className="mb-3">
            <label>New Password (min 8 characters)</label>
            <input type="password" name="newPassword" required minLength={8} />
          </div>
          <div className="mb-4">
            <label>Confirm New Password</label>
            <input type="password" name="confirmPassword" required minLength={8} />
          </div>
          <button className="btn btn-gold" type="submit">Update Password</button>
        </form>
      </div>
    </div>
  );
}
