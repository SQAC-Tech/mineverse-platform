import { NextRequest, NextResponse } from 'next/server';
import { requirePanelScope, PANEL_ADMIN_ACTOR } from '@/lib/panel/require-admin';
import {
  clearLoginOverride,
  clearRegistrationOverride,
  getLoginState,
  getRegistrationState,
  registrationOpenDefault,
  setLoginOpen,
  setRegistrationOpen,
} from '@/lib/platform/settings';

export const dynamic = 'force-dynamic';

/**
 * Runtime switches, read and written from the console.
 *
 * `proxy.ts` gates `/api/admin/*` already; the scope is verified here too,
 * because a page-level proxy is never sufficient on its own.
 */
export async function GET() {
  const guard = await requirePanelScope('admin');
  if (!guard.ok) return guard.response;

  const [registration, login] = await Promise.all([getRegistrationState(), getLoginState()]);

  return NextResponse.json({
    success: true,
    data: {
      registration: {
        open: registration.open,
        // Whether this is the deployment's default or something an organizer
        // set. Worth showing: "closed" reads very differently depending on
        // whether a human decided it.
        source: registration.source,
        env_default: registrationOpenDefault(),
      },
      login,
    },
  });
}

export async function POST(req: NextRequest) {
  const guard = await requirePanelScope('admin');
  if (!guard.ok) return guard.response;

  try {
    const body = await req.json();
    const action = String(body?.action ?? '');

    switch (action) {
      case 'set_registration_open': {
        if (typeof body.open !== 'boolean') {
          return NextResponse.json(
            { success: false, error: { code: 'BAD_VALUE', message: 'open must be true or false.' } },
            { status: 400 },
          );
        }
        const ok = await setRegistrationOpen(body.open, PANEL_ADMIN_ACTOR);
        if (!ok) {
          return NextResponse.json({ success: false, error: { code: 'WRITE_FAILED' } }, { status: 500 });
        }
        // Closing registration is the kind of thing someone asks about later.
        console.warn(`[settings] registration ${body.open ? 'opened' : 'closed'} by ${PANEL_ADMIN_ACTOR}`);
        return NextResponse.json({ success: true, data: await getRegistrationState() });
      }

      case 'clear_registration_override': {
        // Hands the switch back to the environment variable rather than pinning
        // it to a value, so a mistaken flip can be undone without knowing what
        // the deployment's default was.
        const ok = await clearRegistrationOverride();
        if (!ok) {
          return NextResponse.json({ success: false, error: { code: 'WRITE_FAILED' } }, { status: 500 });
        }
        return NextResponse.json({ success: true, data: await getRegistrationState() });
      }

      case 'set_login_open': {
        if (typeof body.open !== 'boolean') {
          return NextResponse.json(
            { success: false, error: { code: 'BAD_VALUE', message: 'open must be true or false.' } },
            { status: 400 },
          );
        }
        const ok = await setLoginOpen(body.open, PANEL_ADMIN_ACTOR);
        if (!ok) {
          return NextResponse.json({ success: false, error: { code: 'WRITE_FAILED' } }, { status: 500 });
        }
        // Shutting 90 teams out of their own qualifier is worth a log line.
        console.warn(`[settings] team login ${body.open ? 'opened' : 'closed'} by ${PANEL_ADMIN_ACTOR}`);
        return NextResponse.json({ success: true, data: { login: await getLoginState() } });
      }

      case 'clear_login_override': {
        const ok = await clearLoginOverride();
        if (!ok) {
          return NextResponse.json({ success: false, error: { code: 'WRITE_FAILED' } }, { status: 500 });
        }
        return NextResponse.json({ success: true, data: { login: await getLoginState() } });
      }

      default:
        return NextResponse.json({ success: false, error: { code: 'UNKNOWN_ACTION' } }, { status: 400 });
    }
  } catch (error) {
    console.error('Admin settings error:', error);
    return NextResponse.json({ success: false, error: { code: 'SERVER_ERROR' } }, { status: 500 });
  }
}
