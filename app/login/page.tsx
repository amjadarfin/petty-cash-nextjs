import { signIn } from "@/lib/auth";
import { AuthError } from "next-auth";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string; error?: string }>;
}) {
  const params = await searchParams;

  async function login(formData: FormData) {
    "use server";
    try {
		  await signIn("credentials", {
			email,
			password,
			redirect: true,
			redirectTo: "/dashboard",
		  });
		} catch (error: any) {
		  if (error.message?.includes("NEXT_REDIRECT")) {
			throw error; // Let Next.js handle success redirections cleanly
		  }
		  return { error: "Invalid email or password." };
		}
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center"
      style={{
        background:
          "radial-gradient(circle at 20% 20%, #1c2c50 0%, transparent 45%), radial-gradient(circle at 80% 80%, #1c2c50 0%, transparent 45%), var(--navy)",
      }}
    >
      <div className="card" style={{ width: 400, borderTop: "4px solid var(--gold)" }}>
        <div
          className="w-14 h-14 rounded-full flex items-center justify-center font-bold mb-4"
          style={{ border: "2px solid var(--gold)", color: "var(--gold)", fontFamily: "Georgia, serif", fontSize: 20 }}
        >
          PC
        </div>
        <h1 style={{ fontSize: 22, color: "var(--navy)", margin: "0 0 2px" }}>Petty Cash Management</h1>
        <p style={{ color: "var(--slate)", fontSize: 12.5, margin: "0 0 22px" }}>Sign in to continue</p>

        {params.error && <div className="banner banner-err">Invalid email or password.</div>}

        <form action={login}>
          <input type="hidden" name="callbackUrl" value={params.callbackUrl || "/dashboard"} />
          <div className="mb-3">
            <label>Email</label>
            <input type="email" name="email" required placeholder="you@example.gov" />
          </div>
          <div className="mb-4">
            <label>Password</label>
            <input type="password" name="password" required placeholder="••••••••" />
          </div>
          <button className="btn btn-gold w-full" type="submit">Sign In</button>
        </form>

        <p style={{ color: "var(--slate)", fontSize: 11, marginTop: 16 }}>
          After running the seed script, sign in with any seeded email (e.g. <code>nadia@example.gov</code>) and password <code>Passw0rd!</code> — see the README.
        </p>
      </div>
    </div>
  );
}
