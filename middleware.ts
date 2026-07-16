import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const ROLE_PREFIXES: Record<string, string[]> = {
  "/approvals/dd": ["DEPUTY_DIRECTOR", "SYSTEM_OWNER"],
  "/approvals/director": ["DIRECTOR", "SYSTEM_OWNER"],
  "/payments": ["ACCOUNTS", "SYSTEM_OWNER"],
  "/admin": ["SYSTEM_OWNER"],
};

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // 1. Let public authentication assets pass through immediately
  const isPublic = pathname.startsWith("/login") || pathname.startsWith("/api/auth");
  if (isPublic) return NextResponse.next();

  // 2. Fetch NextAuth session tokens directly from cookies (handles secure & standard)
  const tokenCookie = 
    req.cookies.get("__Secure-authjs.session-token") || 
    req.cookies.get("authjs.session-token") ||
    req.cookies.get("__Secure-next-auth.session-token") ||
    req.cookies.get("next-auth.session-token");

  // 3. If no session exists, redirect to login page
  if (!tokenCookie?.value) {
    const url = new URL("/login", req.url);
    url.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(url);
  }

  // 4. Decode the lightweight token metadata payload safely
  try {
    // We decode the JWT structure manually to avoid bringing in the massive NextAuth library instance
    const [, payloadBase64] = tokenCookie.value.split(".");
    if (payloadBase64) {
      const decodedPayload = JSON.parse(
        atob(payloadBase64.replace(/-/g, "+").replace(/_/g, "/"))
      );
      
      const role = decodedPayload?.role || decodedPayload?.user?.role;

      // 5. Enforce strict role-based route constraints
      for (const prefix of Object.keys(ROLE_PREFIXES)) {
        if (pathname.startsWith(prefix)) {
          const allowed = ROLE_PREFIXES[prefix];
          if (!role || !allowed.includes(role)) {
            return NextResponse.redirect(new URL("/dashboard", req.url));
          }
        }
      }
    }
  } catch (error) {
    // If token parsing encounters an invalid string pattern, kick to login for safety
    return NextResponse.redirect(new URL("/login", req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
