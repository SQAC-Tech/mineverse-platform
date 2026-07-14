import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { verifyPanelToken, PANEL_COOKIE } from './lib/panel/session';
import { verifySessionToken, SESSION_COOKIE } from './lib/auth/session';

export default async function proxy(request: NextRequest) {
  const path = request.nextUrl.pathname;

  // Admin Guard
  if (path.startsWith('/admin') && path !== '/admin/login') {
    const token = request.cookies.get(PANEL_COOKIE)?.value;
    if (!token || !(await verifyPanelToken(token, 'admin'))) {
      return NextResponse.redirect(new URL('/admin/login', request.url));
    }
  }

  // Attendance Guard
  if (path.startsWith('/attendance') && path !== '/attendance/login') {
    const token = request.cookies.get(PANEL_COOKIE)?.value;
    if (!token || !(await verifyPanelToken(token, 'attendance'))) {
      return NextResponse.redirect(new URL('/attendance/login', request.url));
    }
  }

  // Dashboard Guard
  if (path.startsWith('/dashboard')) {
    const token = request.cookies.get(SESSION_COOKIE)?.value;
    if (!token || !(await verifySessionToken(token))) {
      return NextResponse.redirect(new URL('/login', request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/admin/:path*',
    '/attendance/:path*',
    '/dashboard/:path*'
  ],
};
