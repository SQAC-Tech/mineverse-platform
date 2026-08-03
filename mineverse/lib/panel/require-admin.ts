import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { verifyPanelToken, PANEL_COOKIE, PanelScope } from '@/lib/panel/session';

export type AdminGuardResult =
  | { ok: true; adminId: string }
  | { ok: false; response: NextResponse };

/**
 * Every admin endpoint verifies the panel scope itself. A page-level proxy or an
 * admin identity supplied by the browser is never sufficient (PHASE2_API.md §3).
 *
 * Phase 1 panel tokens carry only `{ scope }` and no per-admin identifier, so
 * attribution records a neutral value rather than mislabeling the scope as an
 * identity. Widen the token payload to get real per-admin audit trails.
 */
export const PANEL_ADMIN_ACTOR = 'panel-admin';

export async function requirePanelScope(scope: PanelScope = 'admin'): Promise<AdminGuardResult> {
  const cookieStore = await cookies();
  const token = cookieStore.get(PANEL_COOKIE)?.value;

  if (!token) {
    return {
      ok: false,
      response: NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Sign in to the panel first.' } },
        { status: 401 },
      ),
    };
  }

  const valid = await verifyPanelToken(token, scope);
  if (!valid) {
    return {
      ok: false,
      response: NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'This action requires the admin panel scope.' } },
        { status: 403 },
      ),
    };
  }

  return { ok: true, adminId: PANEL_ADMIN_ACTOR };
}
