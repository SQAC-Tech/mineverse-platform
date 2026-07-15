import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { verifyPanelToken, PANEL_COOKIE } from './lib/panel/session';
import { verifySessionToken, SESSION_COOKIE } from './lib/auth/session';

function unauthorized() {
  return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
}

export default async function proxy(request: NextRequest) {
  const path = request.nextUrl.pathname;

  // API guards — JSON 401, no redirects
  if (path.startsWith('/api/admin')) {
    const token = request.cookies.get(PANEL_COOKIE)?.value;
    if (!token || !(await verifyPanelToken(token, 'admin'))) return unauthorized();
    return NextResponse.next();
  }

  if (path.startsWith('/api/attendance')) {
    const token = request.cookies.get(PANEL_COOKIE)?.value;
    if (!token || !(await verifyPanelToken(token, 'attendance'))) return unauthorized();
    return NextResponse.next();
  }

  if (path.startsWith('/api/dashboard')) {
    const token = request.cookies.get(SESSION_COOKIE)?.value;
    if (!token || !(await verifySessionToken(token))) return unauthorized();
    return NextResponse.next();
  }

  // Page guards — redirect to the matching login
  if (path.startsWith('/admin') && path !== '/admin/login') {
    const token = request.cookies.get(PANEL_COOKIE)?.value;
    if (!token || !(await verifyPanelToken(token, 'admin'))) {
      return NextResponse.redirect(new URL('/admin/login', request.url));
    }
  }

  if (path.startsWith('/attendance') && path !== '/attendance/login') {
    const token = request.cookies.get(PANEL_COOKIE)?.value;
    if (!token || !(await verifyPanelToken(token, 'attendance'))) {
      return NextResponse.redirect(new URL('/attendance/login', request.url));
    }
  }

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
    '/dashboard/:path*',
    '/api/admin/:path*',
    '/api/attendance/:path*',
    '/api/dashboard/:path*',
  ],
};
