import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getSession } from '@/lib/auth/session';
import { rateLimit } from '@/lib/rate-limit';
import { getAttemptForPlayer, saveAnswer, submitAttempt } from '@/lib/screening/service';

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

const answerSchema = z.object({
  question_id: z.string().uuid(),
  // The slot as displayed to this team, not an index into the stored options.
  // The server maps it back through the attempt's shuffle before storing.
  selected_slot: z.number().int().min(0).max(3),
});

/** Saves one answer. Called on every pick, so a dead laptop loses nothing. */
export async function PUT(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ success: false, error: { code: 'UNAUTHORIZED' } }, { status: 401 });
  }

  // 25 questions in 30 minutes, with changes of mind. Generous, but bounded.
  if (!rateLimit(`screening-answer:${session.team_id}`, 300, 60_000)) {
    return NextResponse.json({ success: false, error: { code: 'RATE_LIMITED' } }, { status: 429 });
  }

  try {
    const parsed = answerSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: { code: 'INVALID_PAYLOAD' } }, { status: 400 });
    }

    const result = await saveAnswer(session.team_id, parsed.data.question_id, parsed.data.selected_slot);
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
