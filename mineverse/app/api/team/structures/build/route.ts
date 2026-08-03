import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { buildStructure, StructureType } from '@/lib/gameplay/structures/service';
import { z } from 'zod';
import { verifyTeamRoundAccess } from '@/lib/gameplay/utils/access';

const buildSchema = z.object({
  type: z.enum(['bat_cave', 'forge', 'bastion', 'tnt_storage']),
  round_id: z.number().int(),
  idempotency_key: z.string().uuid()
});

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ success: false, error: { code: 'UNAUTHORIZED' } }, { status: 401 });

  const idempotencyKeyHeader = req.headers.get('Idempotency-Key');

  try {
    const body = await req.json();
    const result = buildSchema.safeParse({ ...body, idempotency_key: body.idempotency_key || idempotencyKeyHeader });
    
    if (!result.success) {
      return NextResponse.json({ success: false, error: { code: 'INVALID_PAYLOAD' } }, { status: 400 });
    }

    const { type, round_id, idempotency_key } = result.data;

    const access = await verifyTeamRoundAccess(session.team_id, round_id);
    if (!access.hasAccess) {
      return NextResponse.json({ success: false, error: { code: access.error } }, { status: 403 });
    }

    // Building a base structure is free, so there is no resource mutation to
    // key; the one-per-round unique index already makes a retry inert.
    const res = await buildStructure(session.team_id, round_id, type as StructureType);
    
    if (!res.success) {
      return NextResponse.json({ success: false, error: { code: res.error, message: res.message } }, { status: 409 });
    }

    return NextResponse.json({ success: true, data: res.data });
  } catch (error: any) {
    console.error('Build Structure Error:', error);
    return NextResponse.json({ success: false, error: { code: 'SERVER_ERROR' } }, { status: 500 });
  }
}
