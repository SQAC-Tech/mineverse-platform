import Link from "next/link";
import { LayoutDashboard, QrCode, LogOut } from "lucide-react";
import { getSession } from "@/lib/auth/session";
import { redirect } from "next/navigation";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  if (!session) redirect('/login');

  return (
    <div className="flex min-h-screen w-full bg-slate-950 text-slate-50 flex-col md:flex-row">
      <aside className="w-full md:w-64 border-b md:border-b-0 md:border-r border-slate-800 bg-slate-950 p-6 flex flex-col gap-4">
        <div className="mb-6">
          <h1 className="text-2xl font-bold tracking-tight text-white">MINEVERSE</h1>
          <p className="text-slate-400 font-mono mt-1">Team {session.team_code}</p>
        </div>
        <nav className="flex flex-row md:flex-col gap-2 overflow-x-auto">
          <Link
            href="/dashboard"
            className="flex items-center gap-3 rounded-lg px-3 py-2 text-slate-300 hover:bg-slate-800 hover:text-white transition-colors whitespace-nowrap"
          >
            <LayoutDashboard className="h-4 w-4" />
            Dashboard
          </Link>
          <Link
            href="/dashboard/qr"
            className="flex items-center gap-3 rounded-lg px-3 py-2 text-slate-300 hover:bg-slate-800 hover:text-white transition-colors whitespace-nowrap"
          >
            <QrCode className="h-4 w-4" />
            Team QR Code
          </Link>
        </nav>
        <div className="mt-auto hidden md:block">
          <form action="/api/auth/logout" method="POST">
            <button type="submit" className="flex items-center gap-3 rounded-lg px-3 py-2 text-slate-400 hover:text-red-400 transition-colors w-full">
              <LogOut className="h-4 w-4" />
              Logout
            </button>
          </form>
        </div>
      </aside>
      <main className="flex-1 p-4 md:p-8 overflow-y-auto">
        {children}
      </main>
    </div>
  );
}
