import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getSession } from '@/lib/auth/session';
import { rateLimit } from '@/lib/rate-limit';
import { getAttemptForPlayer, saveAnswer, saveGauntletAnswer, submitAttempt } from '@/lib/screening/service';

/** The live paper, with correct answers and difficulty stripped. */
export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ success: false, error: { code: 'UNAUTHORIZED' } }, { status: 401 });
  }

  const result = await getAttemptForPlayer(session.team_id);
  if (!result.ok) {
    return NextResponse.json(
      { success: false, error: { code: result.code, message: result.message } },
      { status: result.status },
    );
  }

  return NextResponse.json({ success: true, data: result.data });
}

const gauntletAnswerSchema = z.object({
  puzzle_id: z.number().int().min(1).max(3),
  answer: z.string().min(1).max(100),
});

/** Saves one puzzle answer in the Gauntlet flow. */
export async function PUT(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ success: false, error: { code: 'UNAUTHORIZED' } }, { status: 401 });
  }

  if (!rateLimit(`screening-answer:${session.team_id}`, 300, 60_000)) {
    return NextResponse.json({ success: false, error: { code: 'RATE_LIMITED' } }, { status: 429 });
  }

  try {
    const body = await req.json();
    const parsed = gauntletAnswerSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: { code: 'INVALID_PAYLOAD' } }, { status: 400 });
    }

    const result = await saveGauntletAnswer(session.team_id, parsed.data.puzzle_id, parsed.data.answer);
    if (!result.ok) {
      return NextResponse.json(
        { success: false, error: { code: result.code, message: result.message } },
        { status: result.status },
      );
    }

    return NextResponse.json({ success: true, data: result.data });
  } catch (error) {
    console.error('Screening answer error:', error);
    return NextResponse.json({ success: false, error: { code: 'SERVER_ERROR' } }, { status: 500 });
  }
}


/**
 * Hands the paper in.
 *
 * Grades server-side from what is already stored, so nothing in the request
 * body can influence the score — there is no body. The response says only that
 * it was received: a score here would reach every team that has not sat the
 * paper yet, through the first player to screenshot it.
 */
export async function POST() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ success: false, error: { code: 'UNAUTHORIZED' } }, { status: 401 });
  }

  const result = await submitAttempt(session.team_id);
  if (!result.ok) {
    return NextResponse.json(
      { success: false, error: { code: result.code, message: result.message } },
      { status: result.status },
    );
  }

  return NextResponse.json({ success: true, data: { submitted_at: result.data.submitted_at } });
}
