import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getSession } from '@/lib/auth/session';
import { supabaseServer } from '@/lib/supabase/server';
import { RELAY_WORDS } from '@/lib/screening/relayLogic';

/**
 * Records a team's relay answers in `relay_screening_attempts`.
 *
 * NOTE: nothing calls this yet. The live Gauntlet stores its answers through
 * `screening_attempts` and the submit path in lib/screening/service.ts, so this
 * table stays empty and `/admin/relay-data` renders an empty list. Wiring it up
 * is still to do — this route is hardened rather than trusted in the meantime.
 *
 * What it will not do, whoever wires it up:
 *
 *  - take `is_completed` from the caller. It shipped that way, so a team could
 *    have posted `{is_completed: true}` and been marked finished without
 *    answering anything. Completion is derived from both answers being present.
 *  - take an arbitrary `word_assigned`. The word decides the puzzle's answer,
 *    so a caller choosing its own word chooses its own difficulty; it must be
 *    one from the catalog. The real flow assigns it server-side in
 *    `startAttempt`, and that is where a wired-up version should read it from.
 *  - accept unbounded text into the database.
 *
 * It still does not *grade* anything — `year1_status` only records that an
 * answer was given. `gradePuzzle` in lib/screening/service.ts is what marks the
 * live Gauntlet, and a wired-up version should go through it rather than
 * inventing a second answer check.
 */

const relaySchema = z.object({
  word_assigned: z.enum(RELAY_WORDS as [string, ...string[]]),
  year1_answer: z.string().trim().max(200).optional().nullable(),
  year2_answer: z.string().trim().max(200).optional().nullable(),
});

export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ success: false, error: { code: 'UNAUTHORIZED' } }, { status: 401 });
    }

    const parsed = relaySchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_PAYLOAD', message: parsed.error.issues[0]?.message } },
        { status: 400 },
      );
    }

    const { word_assigned, year1_answer, year2_answer } = parsed.data;
    const year1 = year1_answer?.length ? year1_answer : null;
    const year2 = year2_answer?.length ? year2_answer : null;
    const isCompleted = Boolean(year1 && year2);

    // One row per team (`team_id` is unique), so upsert rather than
    // read-then-branch: two requests racing each other used to both see no row
    // and both insert, and the second would fail on the constraint.
    const { error } = await supabaseServer
      .from('relay_screening_attempts')
      .upsert(
        {
          team_id: session.team_id,
          word_assigned,
          year1_answer: year1,
          year2_answer: year2,
          year1_status: year1 ? 'completed' : 'pending',
          year2_status: year2 ? 'completed' : 'pending',
          is_completed: isCompleted,
          submitted_at: isCompleted ? new Date().toISOString() : null,
        },
        { onConflict: 'team_id' },
      );

    if (error) {
      console.error('Relay attempt save failed:', error);
      return NextResponse.json({ success: false, error: { code: 'SAVE_FAILED' } }, { status: 500 });
    }

    return NextResponse.json({ success: true, data: { is_completed: isCompleted } });
  } catch (error) {
    console.error('Relay screening route error:', error);
    return NextResponse.json({ success: false, error: { code: 'SERVER_ERROR' } }, { status: 500 });
  }
}
