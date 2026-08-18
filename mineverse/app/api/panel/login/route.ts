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
  // Only failed attempts are charged. Volunteers all sign in from the same
  // campus NAT address on event day, so charging for success meant the sixth
  // person to arrive got a 429 for doing nothing wrong. A brute-forcer produces
  // nothing but failures, so this still bites exactly who it should.
  const failureKey = `panel-login:${clientIp(req) ?? 'unknown'}`;
  const gate = peekRateLimit(failureKey, MAX_FAILURES);
  if (!gate.allowed) {
    return tooManyRequests(
      `Too many failed login attempts. Try again in ${retryHint(gate.retryAfterSeconds)}.`,
      gate.retryAfterSeconds,
    );
  }

  const { password, scope } = await req.json();

  if (scope !== 'admin' && scope !== 'attendance') {
    return NextResponse.json({ success: false, error: 'Invalid scope' }, { status: 400 });
  }

  const validPassword = scope === 'admin' ? env.ADMIN_PASSWORD : env.ATTENDANCE_PASSWORD;

  if (password !== validPassword) {
    consumeRateLimit(failureKey, MAX_FAILURES, FAILURE_WINDOW_MS);
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
