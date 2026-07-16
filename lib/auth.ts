import NextAuth from "next-auth";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@/lib/prisma";
import { authConfig } from "../auth.config";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  session: { strategy: "jwt" },
  ...authConfig,
  providers: [
    Credentials({
      name: "credentials",
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
