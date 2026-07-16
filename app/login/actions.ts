"use server";

import { signIn } from "@/lib/auth";
import { AuthError } from "next-auth";

export async function loginAction(formData: FormData) {
  const emailInput = String(formData.get("email") || "").trim();
  const passwordInput = String(formData.get("password") || "");

  if (!emailInput || !passwordInput) {
    return { error: "Please complete all required fields." };
  }

  try {
    await signIn("credentials", {
      email: emailInput,
      password: passwordInput,
      redirect: true,
      redirectTo: "/dashboard",
    });
  } catch (error: any) {
    // NextAuth handles successful redirects via intentional throw redirects
    if (error instanceof AuthError || error.message?.includes("CredentialsSignin")) {
      return { error: "Invalid email or password structure configured." };
    }
    if (
      error.message?.includes("NEXT_REDIRECT") || 
      error.digest?.includes("NEXT_REDIRECT")
    ) {
      throw error; 
    }
    return { error: "An unexpected database authentication error occurred." };
  }
}
