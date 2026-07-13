import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { PANEL_COOKIE } from '@/lib/panel/session';

export async function POST() {
  (await cookies()).delete(PANEL_COOKIE);
  return NextResponse.json({ success: true });
}
