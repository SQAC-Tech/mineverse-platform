import Link from "next/link";
import { LayoutDashboard, CreditCard, Users, Clock } from "lucide-react";
import { LogoutButton } from "@/components/admin/logout-button";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const mc = { fontFamily: 'var(--font-minecraft), system-ui, sans-serif' };
  
  return (
    <div className="flex min-h-screen w-full bg-[#0a0a0a] text-slate-50 relative overflow-hidden">
      {/* Background */}
      <div style={{
        position: 'absolute',
        inset: 0,
        zIndex: 0,
        backgroundImage: 'url(/cavern-bg.png)',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
        filter: 'brightness(0.2)',
      }} />

      <aside style={{
        position: 'relative',
        zIndex: 10,
        width: '280px',
        background: '#1a110a',
        borderRight: '6px solid #332316',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '4px 0 15px rgba(0,0,0,0.5)',
      }}>
        <div className="p-6 border-b-4 border-[#332316]">
          <h1 style={{
            ...mc,
            fontSize: '1.5rem',
            color: '#fde047',
            textShadow: '2px 2px 0 #000',
            letterSpacing: '0.1em'
          }}>
            ADMIN PANEL
          </h1>
        </div>
        
        <nav className="flex flex-col flex-1 p-4 gap-2 overflow-y-auto">
          {[
            { name: 'Dashboard', href: '/admin', icon: LayoutDashboard },
            { name: 'Payments', href: '/admin/payments', icon: CreditCard },
            { name: 'Teams', href: '/admin/teams', icon: Users },
            { name: 'Rounds', href: '/admin/rounds', icon: Clock },
          ].map((item) => (
            <Link
              key={item.name}
              href={item.href}
              style={{
                ...mc,
                background: '#4a3320',
                borderTop: '3px solid #6c4b31',
                borderLeft: '3px solid #6c4b31',
                borderBottom: '3px solid #1f140c',
                borderRight: '3px solid #1f140c',
                padding: '12px 16px',
                color: '#fff',
                textShadow: '1px 1px 0 #000',
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                fontSize: '0.9rem',
                letterSpacing: '0.05em'
              }}
              className="hover:brightness-110 active:scale-95 transition-all"
            >
              <item.icon className="h-5 w-5 text-[#fca311]" />
              {item.name.toUpperCase()}
            </Link>
          ))}
        </nav>
        
        <div className="p-4 border-t-4 border-[#332316]">
          <LogoutButton />
        </div>
      </aside>
      
      <main className="flex-1 p-8 overflow-y-auto relative z-10">
        <div className="max-w-6xl mx-auto">
          {children}
        </div>
      </main>
    </div>
  );
}
