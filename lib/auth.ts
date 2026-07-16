import NextAuth from "next-auth";
import type { NextAuthConfig } from "next-auth";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@/lib/prisma";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  session: { strategy: "jwt" },
  secret: process.env.AUTH_SECRET,
  pages: {
    signIn: "/login",
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.role = (user as any).role;
        token.department = (user as any).department;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as any).id = token.sub;
        (session.user as any).role = token.role;
        (session.user as any).department = token.department;
      }
      return session;
    },
  },
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

        // 1. Fetch user matching credentials directly from Neon Postgres
        const user = await prisma.user.findUnique({
          where: { email }
        });

        // 2. Reject if no user exists or account is deactivated
        if (!user || !user.active) return null;

        // 3. Evaluate typed string against saved encrypted database hash
        const isValid = await bcrypt.compare(password, user.passwordHash);
        if (!isValid) return null;

        // 4. Return valid parameters for session construction
        return {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          department: user.department ?? undefined
        };
      }
    })
  ]
});
