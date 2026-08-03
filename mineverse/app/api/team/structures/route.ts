import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { getTeamStructures, STRUCTURES, StructureType } from '@/lib/gameplay/structures/service';

export const dynamic = 'force-dynamic';

const META: Record<StructureType, { name: string; ability: string; upgradeName: string; upgradeAbility: string }> = {
  bat_cave: {
    name: 'Bat Cave',
    ability: 'Bats scout hidden passages — reveals one bonus challenge. Also absorbs the Creeper Explosion resource loss.',
    upgradeName: 'Echo Bat Cave',
    upgradeAbility: 'Reveals 2 bonus challenges instead of 1.',
  },
  forge: {
    name: 'Forge',
    ability: '10% reduction on all future crafting costs, for the rest of the event.',
    upgradeName: 'Master Forge',
    upgradeAbility: 'Crafting cost reduction rises from 10% to 20%.',
  },
  bastion: {
    name: 'Bastion',
    ability: 'Blocks one negative world event, including the Lava Eruption.',
    upgradeName: 'Reinforced Bastion',
    upgradeAbility: 'Blocks 2 negative events instead of 1.',
  },
  tnt_storage: {
    name: 'TNT Storage',
    ability: 'Lets you skip one question.',
    upgradeName: 'Mega TNT Storage',
    upgradeAbility: 'Skip 2 questions instead of 1.',
  },
};

/** The team's structures plus the catalog for a round, so the UI can be state-aware. */
export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ success: false, error: { code: 'UNAUTHORIZED' } }, { status: 401 });
  }

  const roundParam = req.nextUrl.searchParams.get('round_id');
  const roundId = roundParam ? Number.parseInt(roundParam, 10) : null;

  try {
    const owned = await getTeamStructures(session.team_id);
    const ownedForRound = roundId ? owned.filter((s) => s.round_id === roundId) : owned;
    const active = ownedForRound.find((s) => s.state !== 'consumed') ?? null;

    const catalog = (Object.keys(STRUCTURES) as StructureType[])
      .filter((type) => (roundId ? STRUCTURES[type].round_id === roundId : true))
      .map((type) => ({
        type,
        ...META[type],
        round_id: STRUCTURES[type].round_id,
        upgrade_cost: STRUCTURES[type].upgradeCost,
        repair_cost: STRUCTURES[type].repairCost,
      }));

    return NextResponse.json({
      success: true,
      data: {
        round_id: roundId,
        // A team gets exactly one free base structure per relevant round.
        chosen: active
          ? { id: active.id, type: active.type, state: active.state, built_at: active.built_at }
          : null,
        all: owned.map((s) => ({ id: s.id, type: s.type, state: s.state, round_id: s.round_id })),
        catalog,
      },
    });
  } catch (error) {
    console.error('Structure Status Error:', error);
    return NextResponse.json({ success: false, error: { code: 'SERVER_ERROR' } }, { status: 500 });
  }
}
