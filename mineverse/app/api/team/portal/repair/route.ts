import { createHash } from 'node:crypto';
import { NextResponse } from 'next/server';
import { requireDay2Access, Day2Session } from '@/lib/day2/access/guard';
import { supabaseServer } from '@/lib/supabase/server';
import { mutateTeamResource } from '@/lib/gameplay/marketplace/resource-client';

/**
 * What a repaired portal is worth in diamonds.
 *
 * The Diamond Pickaxe costs 100 and nothing else on the platform pays diamonds,
 * so without this the last craft of the event is unreachable — every qualified
 * team finished Round 3 holding the 15 this route checks for. Repairing the
 * portal is what funds the pickaxe.
 */
const DIAMONDS_AFTER_REPAIR = 100;

export async function POST() {
  const guardResult = await requireDay2Access();
  if (guardResult instanceof NextResponse) {
    return guardResult;
  }

  const session = guardResult as Day2Session;

  // Check Nether Core from team_game_state
  if (session.state.nether_core_count < 1) {
    return NextResponse.json({ success: false, error: 'MISSING_NETHER_CORE' }, { status: 400 });
  }

  // Check if already repaired
  const { data: existingRepair, error: existingRepairError } = await supabaseServer
    .from('day2_portal_repair')
    .select('*')
    .eq('team_id', session.team_id)
    .maybeSingle();

  if (existingRepairError) {
    return NextResponse.json({ success: false, error: 'DATABASE_ERROR' }, { status: 500 });
  }

  if (existingRepair) {
    return NextResponse.json({ success: true, repaired_at: existingRepair.repaired_at });
  }

  // Check Portal Fragment
  const { data: fragment, error: fragmentError } = await supabaseServer
    .from('day2_portal_fragments')
    .select('*')
    .eq('team_id', session.team_id)
    .maybeSingle();

  if (fragmentError) {
    return NextResponse.json({ success: false, error: 'DATABASE_ERROR' }, { status: 500 });
  }

  if (!fragment) {
    return NextResponse.json({ success: false, error: 'MISSING_PORTAL_FRAGMENT' }, { status: 400 });
  }

  // Check Diamonds
  const { data: resources, error: resourcesError } = await supabaseServer
    .from('resources')
    .select('diamond')
    .eq('team_id', session.team_id)
    .maybeSingle();

  if (resourcesError || !resources) {
    return NextResponse.json({ success: false, error: 'DATABASE_ERROR' }, { status: 500 });
  }

  if (resources.diamond < 15) {
    return NextResponse.json({ success: false, error: 'INSUFFICIENT_DIAMONDS' }, { status: 400 });
  }

  // Record repair
  const { data: repair, error: insertError } = await supabaseServer
    .from('day2_portal_repair')
    .insert({ team_id: session.team_id })
    .select()
    .single();

  if (insertError) {
    if (insertError.code === '23505') { // Unique violation, already repaired
      const { data: retryRepair } = await supabaseServer
        .from('day2_portal_repair')
        .select('*')
        .eq('team_id', session.team_id)
        .single();
      if (retryRepair) {
         return NextResponse.json({ success: true, repaired_at: retryRepair.repaired_at });
      }
    }
    return NextResponse.json({ success: false, error: 'REPAIR_FAILED' }, { status: 500 });
  }

  /**
   * Top up to the target rather than adding to it: a team that somehow already
   * holds more keeps what it has, and a retry that got past the unique-violation
   * branch above cannot pay twice. The key is derived from the team, so the
   * ledger refuses a second grant outright.
   */
  const shortfall = DIAMONDS_AFTER_REPAIR - resources.diamond;
  if (shortfall > 0) {
    const grant = await mutateTeamResource({
      teamId: session.team_id,
      delta: { diamond: shortfall },
      sourceType: 'portal_repair',
      sourceId: session.team_id,
      idempotencyKey: repairGrantKey(session.team_id),
      reason: 'Nether Portal repaired',
    });

    // The repair itself is already recorded and is what gates the round. A
    // grant that fails must not read as a failed repair, or the team is sent
    // back to a step it has finished.
    if (!grant.success && grant.error !== 'CONFLICT') {
      console.error('Portal repair: diamond grant failed', grant.message);
    }
  }

  return NextResponse.json({ success: true, repaired_at: repair.repaired_at });
}

/** Stable per team, so the grant can never be paid twice. */
function repairGrantKey(teamId: string): string {
  return createHash('sha1').update(`mineverse:portal-repair:${teamId}`).digest('hex').slice(0, 32)
    .replace(/^(.{8})(.{4})(.{4})(.{4})(.{12})$/, '$1-$2-$3-$4-$5');
}
