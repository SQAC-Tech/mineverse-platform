import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { listCraftRecipes } from '@/lib/gameplay/crafting/service';

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ success: false, error: { code: 'UNAUTHORIZED' } }, { status: 401 });

  try {
    const data = await listCraftRecipes(session.team_id);
    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('Dev4 Craft Recipes Error:', error);
    return NextResponse.json({ success: false, error: { code: 'SERVER_ERROR' } }, { status: 500 });
  }
}