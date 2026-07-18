'use client';

import { LogOut } from "lucide-react";

export function LogoutButton() {
  const mc = { fontFamily: 'var(--font-minecraft), system-ui, sans-serif' };

  return (
    <button
      onClick={async () => {
        await fetch('/api/panel/logout', { method: 'POST' });
        window.location.href = '/admin/login';
      }}
      style={{
        width: '100%',
        background: '#8b0000',
        borderTop: '3px solid #b22222',
        borderLeft: '3px solid #b22222',
        borderBottom: '3px solid #5c0000',
        borderRight: '3px solid #5c0000',
        padding: '12px 16px',
        color: '#fff',
        textShadow: '1px 1px 0 #000',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '12px',
        ...mc
      }}
      className="hover:brightness-110 active:scale-95 transition-all cursor-pointer"
    >
      <LogOut className="h-4 w-4" />
      LOGOUT
    </button>
  );
}
