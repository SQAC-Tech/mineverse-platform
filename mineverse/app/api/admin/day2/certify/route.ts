import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requirePanelScope } from '@/lib/panel/require-admin';
import { supabaseServer } from '@/lib/supabase/server';

const certifySchema = z.object({
  team_id: z.string().uuid(),
  reason: z.string().min(1),
  evidence: z.record(z.string(), z.any()).optional().default({}),
});

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

    // Check provisional winner status
    const { data: provisional, error: provError } = await supabaseServer
      .from('day2_provisional_winners')
      .select('*')
      .eq('team_id', team_id)
      .single();

    if (provError || !provisional) {
      return NextResponse.json({ success: false, error: 'NOT_PROVISIONAL_WINNER' }, { status: 400 });
    }

    if (provisional.status === 'certified') {
      return NextResponse.json({ success: false, error: 'ALREADY_CERTIFIED' }, { status: 400 });
    }

    // Update status to certified
    const { error: updateError } = await supabaseServer
      .from('day2_provisional_winners')
      .update({ status: 'certified' })
      .eq('team_id', team_id);

    if (updateError) {
      return NextResponse.json({ success: false, error: 'UPDATE_FAILED' }, { status: 500 });
    }

    // Insert certification record
    const { error: insertError } = await supabaseServer
      .from('day2_champion_certifications')
      .insert({
        team_id,
        certified_by: guard.adminId,
        reason,
        evidence,
      });

    if (insertError) {
      // Best effort rollback, though in a real system we'd use a transaction (RPC)
      await supabaseServer
        .from('day2_provisional_winners')
        .update({ status: provisional.status })
        .eq('team_id', team_id);
      
      return NextResponse.json({ success: false, error: 'CERTIFICATION_FAILED' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Certify Winner Error:', error);
    return NextResponse.json({ success: false, error: 'SERVER_ERROR' }, { status: 500 });
  }
}
