import { LogoutButton } from '@/components/admin/logout-button';
import { AdminNav } from '@/components/admin/admin-nav';
import '../../theme-kit.css';
import '../nether.css';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="nether"
      style={{ display: 'flex', minHeight: '100vh', width: '100%', position: 'relative' }}
    >
      {/* Nether backdrop, kept low-contrast so it never competes with content. */}
      <div
        aria-hidden
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 0,
          backgroundImage: 'url(/cavern-bg.webp)',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          opacity: 0.1,
          filter: 'saturate(0.6) hue-rotate(-25deg)',
          pointerEvents: 'none',
        }}
      />
      <div
        aria-hidden
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 0,
          background: 'radial-gradient(ellipse at 78% 12%, rgb(76 8 85 / 45%), transparent 55%)',
          pointerEvents: 'none',
        }}
      />

      <aside
        style={{
          position: 'relative',
          zIndex: 10,
          width: 232,
          flexShrink: 0,
          background: 'var(--bg-void)',
          borderRight: '2px solid rgb(150 35 14 / 35%)',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <div style={{ padding: '18px 16px 14px' }}>
          <div
            style={{
              fontSize: 15,
              letterSpacing: 2,
              color: 'var(--accent-primary)',
              textShadow: '0 0 12px rgb(235 71 4 / 55%)',
            }}
          >
            MINEVERSE
          </div>
          <div className="n-panel-sub" style={{ marginTop: 3 }}>Command Block</div>
          <div style={{ marginTop: 12 }}><hr className="n-lava-divider" /></div>
        </div>

        <AdminNav />

        <div style={{ padding: 12, borderTop: '2px solid rgb(150 35 14 / 30%)' }}>
          <LogoutButton />
        </div>
      </aside>

      <main style={{ flex: 1, position: 'relative', zIndex: 10, padding: '28px 24px', overflowX: 'hidden' }}>
        <div style={{ maxWidth: 1240, margin: '0 auto' }}>{children}</div>
      </main>
    </div>
  );
}
