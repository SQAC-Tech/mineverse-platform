import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requirePanelScope } from '@/lib/panel/require-admin';
import { supabaseServer } from '@/lib/supabase/server';
import { getRound5Leaderboard } from '@/lib/gameplay/day2/leaderboard';

const certifySchema = z.object({
  team_id: z.string().uuid(),
  reason: z.string().min(1),
  evidence: z.record(z.string(), z.any()).optional().default({}),
});

/**
 * Certifies the champion, against the standings.
 *
 * ## Why not the provisional claim
 *
 * This used to refuse any team without a `day2_provisional_winners` row, and
 * that row is only written when a team clears the dragon's pass mark. Round 5 is
 * ranked on the dragon and the seven questions together with nothing weighted,
 * so the two could disagree: a team could top the standings on twenty-three
 * combined and still be uncertifiable because twelve of its twenty-five on the
 * dragon fell one short of the label.
 *
 * The standings are the rule the teams were told, so the standings are what this
 * checks. The claim is still written and marked certified, because the public
 * leaderboard reads that table.
 *
 * ## The rank is recorded, not enforced
 *
 * An organiser may certify a team that is not first — a disqualification above
 * it, a manual ruling, a scoring correction that has not landed yet. Refusing
 * that would mean the only way to act on it is editing the database by hand at
 * the moment the result is announced. So the standing is captured into the
 * evidence instead: certifying anyone but the leader leaves a row that says so,
 * next to the reason the organiser gave.
 */
export async function POST(req: NextRequest) {
  const guard = await requirePanelScope('admin');
  if (!guard.ok) return guard.response;

  try {
    const body = await req.json();
    const parsed = certifySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: 'INVALID_PAYLOAD' }, { status: 400 });
    }

    const { team_id, reason, evidence } = parsed.data;

    const standings = await getRound5Leaderboard();
    const standing = standings.find((row) => row.team_id === team_id);

    // Not in the standings means not qualified for Day 2 — there is no result to
    // certify, and this is the one case worth refusing outright.
    if (!standing) {
      return NextResponse.json({ success: false, error: 'NOT_IN_ROUND_5_STANDINGS' }, { status: 400 });
    }

    const { data: alreadyCertified } = await supabaseServer
      .from('day2_champion_certifications')
      .select('team_id')
      .limit(1)
      .maybeSingle();

    if (alreadyCertified) {
      return NextResponse.json(
        { success: false, error: 'ALREADY_CERTIFIED', team_id: alreadyCertified.team_id },
        { status: 400 },
      );
    }

    const leader = standings[0];

    const { error: insertError } = await supabaseServer
      .from('day2_champion_certifications')
      .insert({
        team_id,
        certified_by: guard.adminId,
        reason,
        evidence: {
          ...evidence,
          // What the standings said at the moment of certification. The
          // certificate has to be defensible after the numbers move on.
          rank: standing.rank,
          total_correct: standing.total_correct,
          boss_correct: standing.boss_correct,
          boss_status: standing.boss_status,
          questions_correct: standing.questions_correct,
          was_leader: standing.rank === 1,
          leader_at_certification: leader ? leader.team_code : null,
          certified_at: new Date().toISOString(),
        },
      });

    if (insertError) {
      console.error('Certify: could not record the certification', insertError.message);
      return NextResponse.json({ success: false, error: 'CERTIFICATION_FAILED' }, { status: 500 });
    }

    /**
     * The public leaderboard reads the claim table, so the claim is brought into
     * line with the certificate — written first if the team never cleared the
     * dragon's pass mark and so never filed one. Best effort: the certificate is
     * the record that decides, and it is already in.
     */
    const { error: claimError } = await supabaseServer
      .from('day2_provisional_winners')
      .upsert(
        { team_id, claimed_at: new Date().toISOString(), status: 'certified' },
        { onConflict: 'team_id' },
      );

    if (claimError) {
      console.error('Certify: claim row not updated', claimError.message);
    }

    return NextResponse.json({
      success: true,
      data: {
        team_code: standing.team_code,
        rank: standing.rank,
        total_correct: standing.total_correct,
        was_leader: standing.rank === 1,
      },
    });
  } catch (error) {
    console.error('Certify Winner Error:', error);
    return NextResponse.json({ success: false, error: 'SERVER_ERROR' }, { status: 500 });
  }
}
