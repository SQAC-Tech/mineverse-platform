'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard, CreditCard, Users, Clock, ClipboardCheck,
  Zap, Swords, Coins, Trophy, ClipboardList, Eye, Moon,
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
    // The screening runs before the event, so it sits with the setup screens
    // rather than with the things an organizer touches on event day.
    group: 'Screening',
    items: [
      { name: 'Screening Round', href: '/admin/screening', icon: Moon },
    ],
  },
  {
    group: 'Live Ops',
    items: [
      { name: 'Rounds', href: '/admin/rounds', icon: Clock },
      { name: 'World Events', href: '/admin/events', icon: Zap },
      // Offline games are played off the platform now; whatever an organizer
      // decides a team earned is handed out on the Resources screen.
      { name: 'Grant Resources', href: '/admin/resources', icon: Coins },
      { name: 'PvP Matches', href: '/admin/pvp', icon: Swords },
      { name: 'Proctor', href: '/admin/proctor', icon: Eye },
      { name: 'Desk Attendance', href: '/admin/staff-attendance', icon: ClipboardList },
    ],
  },
  {
    group: 'Results',
    items: [
      { name: 'Grading', href: '/admin/grading', icon: ClipboardCheck },
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
