import type { NextAuthConfig } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

export const authConfig = {
  secret: process.env.AUTH_SECRET,
  providers: [
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" }
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        const email = String(credentials.email).toLowerCase().trim();
        const password = String(credentials.password);

        // 1. Fetch user matching credential entries from Neon Postgres
        const user = await prisma.user.findUnique({
          where: { email }
        });

        // 2. Reject if no user exists or account is inactive
        if (!user || !user.active) return null;

        // 3. Cryptographically evaluate entries against database hash values
        const isValid = await bcrypt.compare(password, user.passwordHash);
        if (!isValid) return null;

        // 4. Return valid parameters to construct the Edge session tokens securely
        return {
			  id: user.id,
			  name: user.name,
			  email: user.email,
			  role: user.role,
			  department: user.department ?? undefined // This safely converts null to undefined for NextAuth
			};
      }
    })
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.role = (user as any).role;
        token.department = (user as any).department;
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        (session.user as any).id = token.sub;
        (session.user as any).role = token.role;
        (session.user as any).department = token.department;
      }
      return session;
    },
  },
  pages: {
    signIn: "/login",
  },
} satisfies NextAuthConfig;