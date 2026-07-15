import type { Metadata } from "next";
import "./globals.css";
import Sidebar from "@/components/Sidebar";
import { auth } from "@/lib/auth";

export const metadata: Metadata = {
  title: "Petty Cash Management System",
  description: "Petty Cash submission, approval and payment workflow",
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const session = await auth();

  return (
    <html lang="en">
      <body className="antialiased">
        {session?.user ? (
          <div className="flex" style={{ minHeight: "100vh" }}>
            <Sidebar />
            <main className="flex-1 px-8 py-7" style={{ maxWidth: 1180 }}>
              {children}
            </main>
          </div>
        ) : (
          children
        )}
      </body>
    </html>
  );
}
