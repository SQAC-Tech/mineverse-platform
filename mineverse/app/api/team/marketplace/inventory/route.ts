import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { supabaseServer } from '@/lib/supabase/server';
import { CONSUMABLE_ITEMS } from '@/lib/gameplay/marketplace/service';

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ success: false, error: { code: 'UNAUTHORIZED' } }, { status: 401 });

  try {
    const { data: transactions, error: txError } = await supabaseServer
      .from('transactions')
      .select('*')
      .eq('team_id', session.team_id)
      .in('item_type', [...CONSUMABLE_ITEMS])
      .order('created_at', { ascending: false });

    if (txError) throw txError;

    const { data: uses, error: useError } = await supabaseServer
      .from('item_uses')
      .select('transaction_id, consumed_at')
      .eq('team_id', session.team_id);

    if (useError) throw useError;

    // transaction_id is nullable on item_uses; a use with no purchase behind it
    // cannot mark any inventory row as consumed.
    const usedByTransaction = new Map<string, string | null>();
    for (const use of uses ?? []) {
      if (use.transaction_id) usedByTransaction.set(use.transaction_id, use.consumed_at);
    }

    const items = (transactions ?? []).map((tx) => ({
      transaction_id: tx.id,
      item_type: tx.item_type,
      created_at: tx.created_at,
      used: usedByTransaction.has(tx.id),
      consumed_at: usedByTransaction.get(tx.id) ?? null,
    }));

    return NextResponse.json({ success: true, data: items });
  } catch (error: unknown) {
    console.error('Get Inventory Error:', error);
    return NextResponse.json({ success: false, error: { code: 'SERVER_ERROR' } }, { status: 500 });
  }
}
