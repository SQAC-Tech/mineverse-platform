'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { Menu, X } from 'lucide-react';
import { AdminNav } from '@/components/admin/admin-nav';
import { LogoutButton } from '@/components/admin/logout-button';

/**
 * Layout chrome for the admin panel. Client-side only because the sidebar
 * collapses into a drawer below 900px and needs open/closed state; the CSS for
 * both layouts lives in `app/admin/nether.css`.
 */
export function AdminShell({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  // Navigating on a phone should dismiss the drawer, not leave it covering the
  // page the organizer just asked for.
  useEffect(() => { setOpen(false); }, [pathname]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  return (
    <div className="nether n-shell">
      {/* Backdrop, kept faint so it never competes with content. */}
      <div
        aria-hidden
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 0,
          backgroundImage: 'url(/cavern-bg.webp)',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          opacity: 0.07,
          filter: 'saturate(0.35) hue-rotate(150deg)',
          pointerEvents: 'none',
        }}
      />
      <div
        aria-hidden
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 0,
          background: 'radial-gradient(ellipse at 78% 8%, rgb(56 189 248 / 12%), transparent 58%)',
          pointerEvents: 'none',
        }}
      />

      <header className="n-topbar">
        <button
          type="button"
          className="n-btn n-btn-ghost n-btn-sm"
          onClick={() => setOpen(true)}
          aria-label="Open navigation"
          aria-expanded={open}
        >
          <Menu size={16} />
        </button>
        <span className="n-brand">MINEVERSE</span>
      </header>

      {open && <div className="n-scrim" onClick={() => setOpen(false)} aria-hidden />}

      <aside className={`n-sidebar ${open ? 'open' : ''}`}>
        <div style={{ padding: '18px 16px 14px', display: 'flex', alignItems: 'flex-start', gap: 8 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="n-brand">MINEVERSE</div>
            <div className="n-panel-sub" style={{ marginTop: 4 }}>Command Block</div>
          </div>
          <button
            type="button"
            className="n-btn n-btn-ghost n-btn-sm"
            onClick={() => setOpen(false)}
            aria-label="Close navigation"
            style={{ display: open ? 'inline-flex' : 'none' }}
          >
            <X size={16} />
          </button>
        </div>
        <div style={{ padding: '0 16px 8px' }}><hr className="n-lava-divider" /></div>

        <AdminNav />

        <div style={{ padding: 12, borderTop: '1px solid rgb(56 83 110 / 40%)' }}>
          <LogoutButton />
        </div>
      </aside>

      <main className="n-main">
        <div className="n-main-inner">{children}</div>
      </main>
    </div>
  );
}
