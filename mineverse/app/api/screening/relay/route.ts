import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { supabaseServer } from '@/lib/supabase/server';

export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { word_assigned, year1_answer, year2_answer, is_completed } = body;

    if (!word_assigned) {
      return NextResponse.json({ error: 'Missing word_assigned' }, { status: 400 });
    }

    // Use service client to bypass RLS if needed, or regular client if RLS is fine.
    const supabase = supabaseServer;
    
    // Check if an attempt already exists
    const { data: existingAttempt } = await supabase
      .from('relay_screening_attempts')
      .select('id')
      .eq('team_id', session.team_id)
      .single();

    let result;
    const now = new Date().toISOString();

    if (existingAttempt) {
      // Update existing
      const updateData: any = {
        year1_answer,
        year2_answer,
        year1_status: year1_answer ? 'completed' : 'pending',
        year2_status: year2_answer ? 'completed' : 'pending',
        is_completed: is_completed || false,
      };
      
      if (is_completed) {
        updateData.submitted_at = now;
      }

      result = await supabase
        .from('relay_screening_attempts')
        .update(updateData)
        .eq('team_id', session.team_id);
    } else {
      // Insert new
      const insertData: any = {
        team_id: session.team_id,
        word_assigned,
        year1_answer,
        year2_answer,
        year1_status: year1_answer ? 'completed' : 'pending',
        year2_status: year2_answer ? 'completed' : 'pending',
        is_completed: is_completed || false,
      };

      if (is_completed) {
        insertData.submitted_at = now;
      }

      result = await supabase
        .from('relay_screening_attempts')
        .insert(insertData);
    }

    if (result.error) {
      console.error('Error saving relay attempt:', result.error);
      return NextResponse.json({ error: 'Failed to save attempt' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('Error in relay screening API:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
