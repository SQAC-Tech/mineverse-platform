import { SignJWT, jwtVerify } from 'jose';

const SECRET = new TextEncoder().encode(process.env.JWT_SECRET!);
export type PanelScope = 'admin' | 'attendance';

export async function createPanelToken(scope: PanelScope) {
  return new SignJWT({ scope })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(scope === 'admin' ? '12h' : '24h')
    .sign(SECRET);
}

export async function verifyPanelToken(token: string, requiredScope: PanelScope) {
  try {
    const { payload } = await jwtVerify(token, SECRET, { clockTolerance: 60 });
    return payload.scope === requiredScope;
  } catch {
    return false;
  }
}

export const PANEL_COOKIE = 'panel_session';
