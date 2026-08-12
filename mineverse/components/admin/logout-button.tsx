'use client';

import { LogOut } from 'lucide-react';

export function LogoutButton() {
  return (
    <button
      type="button"
      className="n-btn n-btn-ghost"
      style={{ width: '100%', justifyContent: 'flex-start' }}
      onClick={async () => {
        await fetch('/api/panel/logout', { method: 'POST' });
        window.location.href = '/admin/login';
      }}
    >
      <LogOut size={14} />
      Log out
    </button>
  );
}
