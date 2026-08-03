import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { supabaseServer } from '@/lib/supabase/server';
import { CHOICES, ChoiceKey } from '@/lib/gameplay/choices/service';

export const dynamic = 'force-dynamic';

const COPY: Record<ChoiceKey, { title: string; prompt: string; options: Record<string, string> }> = {
  ancient_shrine: {
    title: 'Ancient Shrine',
    prompt: 'An Ancient Shrine rises from the swamp. Every team must choose one offering.',
    options: {
      option_a: 'Offer 10 Wood',
      option_b: 'Offer 5 Iron',
      ignore: 'Ignore the Shrine',
    },
  },
  piglin_merchant: {
    title: 'Piglin Merchant',
    prompt: 'A Piglin Merchant offers a rare trade. Choose one.',
    options: {
      option_a: 'Trade 10 Gold',
      option_b: 'Trade 4 Emeralds',
      ignore: 'Ignore the Merchant',
    },
  },
};

/**
 * Choice catalog plus this team's existing decisions. The deltas come from the
 * server-side catalog so the client never carries its own copy of the economy.
 */
export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ success: false, error: { code: 'UNAUTHORIZED' } }, { status: 401 });
  }

  const requested = req.nextUrl.searchParams.get('choice_key') as ChoiceKey | null;

  try {
    const { data: decisions, error } = await supabaseServer
      .from('choice_decisions')
      .select('choice_key, option_selected, created_at')
      .eq('team_id', session.team_id);

    if (error) throw error;

    const decided = new Map((decisions ?? []).map((d) => [d.choice_key, d]));
    const keys = (requested ? [requested] : (Object.keys(CHOICES) as ChoiceKey[])).filter((k) => k in CHOICES);

    const choices = keys.map((key) => {
      const config = CHOICES[key];
      const copy = COPY[key];
      const decision = decided.get(key) ?? null;

      return {
        choice_key: key,
        title: copy.title,
        prompt: copy.prompt,
        decided: Boolean(decision),
        selected_option: decision?.option_selected ?? null,
        decided_at: decision?.created_at ?? null,
        options: (Object.keys(config.options) as Array<keyof typeof config.options>).map((option) => ({
          option,
          label: copy.options[option] ?? option,
          delta: config.options[option],
        })),
      };
    });

    return NextResponse.json({ success: true, data: { choices, server_time: new Date().toISOString() } });
  } catch (error) {
    console.error('Choice Status Error:', error);
    return NextResponse.json({ success: false, error: { code: 'SERVER_ERROR' } }, { status: 500 });
  }
}
