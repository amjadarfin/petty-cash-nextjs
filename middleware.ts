import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";

const ROLE_PREFIXES: Record<string, string[]> = {
  "/approvals/dd": ["DEPUTY_DIRECTOR", "SYSTEM_OWNER"],
  "/approvals/director": ["DIRECTOR", "SYSTEM_OWNER"],
  "/payments": ["ACCOUNTS", "SYSTEM_OWNER"],
  "/admin": ["SYSTEM_OWNER"],
};

export default auth((req) => {
  const { pathname } = req.nextUrl;
  const isPublic = pathname.startsWith("/login") || pathname.startsWith("/api/auth");
  if (isPublic) return NextResponse.next();

  if (!req.auth?.user) {
    const url = new URL("/login", req.url);
    url.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(url);
  }

  const role = (req.auth.user as { role?: string }).role;
  for (const prefix of Object.keys(ROLE_PREFIXES)) {
    if (pathname.startsWith(prefix)) {
      const allowed = ROLE_PREFIXES[prefix];
      if (!role || !allowed.includes(role)) {
        return NextResponse.redirect(new URL("/dashboard", req.url));
      }
    }
  }
  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
