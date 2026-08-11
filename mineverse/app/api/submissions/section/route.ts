import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { lockTeamSection, sectionSubmitPayloadSchema } from '@/lib/gameplay/questions/service';

/**
 * Submits a whole section (one question tab) and locks it.
 *
 * Locking is irreversible for the team: `upsertTeamSubmission` refuses to write
 * over a locked row, so once this returns the answers in that tab are final.
 */
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ success: false, error: { code: 'UNAUTHORIZED' } }, { status: 401 });

  try {
    const body = await req.json();
    const parsed = sectionSubmitPayloadSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: { code: 'INVALID_PAYLOAD' } }, { status: 400 });
    }

    const result = await lockTeamSection(session.team_id, parsed.data);
    if (!result.ok) {
      return NextResponse.json(
        { success: false, error: { code: result.code, message: result.message } },
        { status: result.status },
      );
    }

    return NextResponse.json({ success: true, data: result.data });
  } catch (error) {
    console.error('Section Submit Error:', error);
    return NextResponse.json({ success: false, error: { code: 'SERVER_ERROR' } }, { status: 500 });
  }
}
