"use client";

import { useState } from "react";
import { signIn } from "@/lib/auth"; // Explicit server function lookup link
import { useSearchParams } from "next/navigation";

export default function LoginPage() {
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") || "/dashboard";

  async function handleLoginSubmission(formData: FormData) {
    setErrorMessage(null);
    setIsLoading(true);

    const emailInput = String(formData.get("email") || "").trim();
    const passwordInput = String(formData.get("password") || "");

    if (!emailInput || !passwordInput) {
      setErrorMessage("Please complete all required login parameters.");
      setIsLoading(false);
      return;
    }

    try {
      // Execute standard credential authorization lifecycle
      await signIn("credentials", {
        email: emailInput,
        password: passwordInput,
        redirect: true,
        redirectTo: callbackUrl,
      });
    } catch (error: any) {
      // Catch standard internal server redirects and let the native loader pass through
      if (
        error.message?.includes("NEXT_REDIRECT") || 
        error.digest?.includes("NEXT_REDIRECT")
      ) {
        throw error;
      }
      
      // Map safe string text output to local state array indicators
      setErrorMessage("Invalid email or password structure configured.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "100vh", backgroundColor: "#f3f4f6" }}>
      <div style={{ backgroundColor: "#ffffff", padding: "2.5rem", borderRadius: "8px", boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)", width: "100%", maxWidth: "400px" }}>
        
        <div style={{ textAlign: "center", marginBottom: "2rem" }}>
          <h1 style={{ fontSize: "1.75rem", fontWeight: 700, color: "#111827", marginBottom: "0.5rem" }}>Petty Cash System</h1>
          <p style={{ color: "#6b7280", fontSize: "0.875rem" }}>Sign in to manage office ledger workflows</p>
        </div>

        {/* Friendly Error Banner Panel */}
        {errorMessage && (
          <div style={{ backgroundColor: "#fee2e2", border: "1px solid #fca5a5", color: "#b91c1c", padding: "0.75rem 1rem", borderRadius: "6px", fontSize: "0.875rem", marginBottom: "1.5rem" }}>
            {errorMessage}
          </div>
        )}

        <form action={handleLoginSubmission} style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.375rem" }}>
            <label htmlFor="email" style={{ fontSize: "0.875rem", fontWeight: 500, color: "#374151" }}>Email Address</label>
            <input
              id="email"
              name="email"
              type="email"
              required
              placeholder="e.g. admin@nutech.edu.pk"
              style={{ width: "100%", padding: "0.625rem 0.875rem", border: "1px solid #d1d5db", borderRadius: "6px", fontSize: "0.95rem" }}
            />
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "0.375rem" }}>
            <label htmlFor="password" style={{ fontSize: "0.875rem", fontWeight: 500, color: "#374151" }}>Password</label>
            <input
              id="password"
              name="password"
              type="password"
              required
              placeholder="••••••••"
              style={{ width: "100%", padding: "0.625rem 0.875rem", border: "1px solid #d1d5db", borderRadius: "6px", fontSize: "0.95rem" }}
            />
          </div>

          <button
            type="submit"
            disabled={isLoading}
            style={{ width: "100%", padding: "0.75rem", backgroundColor: isLoading ? "#9ca3af" : "#2563eb", color: "#ffffff", fontWeight: 600, border: "none", borderRadius: "6px", cursor: isLoading ? "not-allowed" : "pointer", fontSize: "1rem", marginTop: "0.5rem", transition: "background-color 0.2s" }}
          >
            {isLoading ? "Verifying Credentials..." : "Sign In"}
          </button>
        </form>
      </div>
    </div>
  );
}
