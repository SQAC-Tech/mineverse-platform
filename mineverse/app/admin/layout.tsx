import Link from "next/link";
import { LayoutDashboard, CreditCard, Users, Clock } from "lucide-react";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen w-full bg-slate-950 text-slate-50">
      <aside className="w-64 border-r border-slate-800 bg-slate-950 p-6 flex flex-col gap-4">
        <h1 className="text-2xl font-bold tracking-tight text-white mb-6">MINEVERSE Admin</h1>
        <nav className="flex flex-col gap-2">
          <Link
            href="/admin"
            className="flex items-center gap-3 rounded-lg px-3 py-2 text-slate-300 hover:bg-slate-800 hover:text-white transition-colors"
          >
            <LayoutDashboard className="h-4 w-4" />
            Dashboard
          </Link>
          <Link
            href="/admin/payments"
            className="flex items-center gap-3 rounded-lg px-3 py-2 text-slate-300 hover:bg-slate-800 hover:text-white transition-colors"
          >
            <CreditCard className="h-4 w-4" />
            Payments
          </Link>
          <Link
            href="/admin/teams"
            className="flex items-center gap-3 rounded-lg px-3 py-2 text-slate-300 hover:bg-slate-800 hover:text-white transition-colors"
          >
            <Users className="h-4 w-4" />
            Teams
          </Link>
          <Link
            href="/admin/rounds"
            className="flex items-center gap-3 rounded-lg px-3 py-2 text-slate-300 hover:bg-slate-800 hover:text-white transition-colors"
          >
            <Clock className="h-4 w-4" />
            Rounds
          </Link>
        </nav>
      </aside>
      <main className="flex-1 p-8 overflow-y-auto">
        {children}
      </main>
    </div>
  );
}
