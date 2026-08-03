'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard, CreditCard, Users, Clock, ClipboardCheck,
  Zap, Dices, Swords, Coins, Trophy,
} from 'lucide-react';

/**
 * Grouped by when an organizer uses each screen on event day, not by which
 * developer owned it.
 */
const NAV_GROUPS = [
  {
    group: 'Setup',
    items: [
      { name: 'Overview', href: '/admin', icon: LayoutDashboard },
      { name: 'Payments', href: '/admin/payments', icon: CreditCard },
      { name: 'Teams', href: '/admin/teams', icon: Users },
    ],
  },
  {
    group: 'Live Ops',
    items: [
      { name: 'Rounds', href: '/admin/rounds', icon: Clock },
      { name: 'World Events', href: '/admin/events', icon: Zap },
      { name: 'Offline Games', href: '/admin/offline', icon: Dices },
      { name: 'PvP Matches', href: '/admin/pvp', icon: Swords },
    ],
  },
  {
    group: 'Results',
    items: [
      { name: 'Grading', href: '/admin/grading', icon: ClipboardCheck },
      { name: 'Resources', href: '/admin/resources', icon: Coins },
      { name: 'Qualification', href: '/admin/qualification', icon: Trophy },
    ],
  },
];

export function AdminNav() {
  const pathname = usePathname();

  return (
    <nav style={{ display: 'flex', flexDirection: 'column', flex: 1, padding: '4px 10px', overflowY: 'auto' }}>
      {NAV_GROUPS.map((group) => (
        <div key={group.group}>
          <div className="n-nav-group">{group.group}</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            {group.items.map((item) => {
              // `/admin` would otherwise match every child route.
              const active = item.href === '/admin' ? pathname === '/admin' : pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`n-nav-item ${active ? 'active' : ''}`}
                  aria-current={active ? 'page' : undefined}
                >
                  <item.icon size={15} strokeWidth={2.5} />
                  {item.name}
                </Link>
              );
            })}
          </div>
        </div>
      ))}
    </nav>
  );
}
