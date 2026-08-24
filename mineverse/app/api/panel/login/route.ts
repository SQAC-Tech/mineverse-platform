import { NextResponse } from 'next/server';
import { createPanelToken, PANEL_COOKIE } from '@/lib/panel/session';
import { env } from '@/lib/env';
import { cookies } from 'next/headers';
import { consumeRateLimit, peekRateLimit, retryHint, tooManyRequests } from '@/lib/rate-limit';
import { clientIp } from '@/lib/request-ip';

// Charged per failure, not per attempt — see the guard in POST.
const MAX_FAILURES = 20;
const FAILURE_WINDOW_MS = 15 * 60_000;

export async function POST(req: Request) {

  const { password, scope } = await req.json();

  if (scope !== 'admin' && scope !== 'attendance') {
    return NextResponse.json({ success: false, error: 'Invalid scope' }, { status: 400 });
  }

  const validPassword = scope === 'admin' ? env.ADMIN_PASSWORD : env.ATTENDANCE_PASSWORD;

  if (password !== validPassword) {
    return NextResponse.json({ success: false, error: 'Invalid password' }, { status: 401 });
  }

  const token = await createPanelToken(scope);
  
  (await cookies()).set(PANEL_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: scope === 'admin' ? 12 * 3600 : 24 * 3600,
    path: '/',
  });

  return NextResponse.json({ success: true, redirect: `/${scope}` });
}
