import { supabaseServer } from '@/lib/supabase/server';

const db = supabaseServer as any;

/** Extract academic year from an SRM registration number.
 *  Format: RA{YY}11003XXXXXXX
 *  e.g. RA2511003010668 → "25" → "2nd Year"
 *       RA2611003010668 → "26" → "1st Year"
 */
export function yearFromRegNo(regNo: string): string | null {
  if (!regNo) return null;
  // RA + 2-digit batch year + rest
  const match = regNo.match(/^RA(\d{2})\d{11}$/);
  if (!match) return null;
  const batch = match[1]; // e.g. "25" or "26"
  return batch;
}

export function batchToLabel(batch: string | null): string {
  if (!batch) return 'Unknown Year';
  const num = parseInt(batch, 10);
  // Assume the current event year context: 2026 event → batch 26 = 1st year, batch 25 = 2nd year
  if (num === 26) return '1st Year';
  if (num === 25) return '2nd Year';
  return `Batch '${batch}`;
}

/**
 * Returns the dominant academic year label for a team based on
 * the registration numbers of its members.
 */
export async function getTeamYear(teamId: string): Promise<string> {
  const { data: members, error } = await db
    .from('members')
    .select('registration_no')
    .eq('team_id', teamId)
    .not('registration_no', 'is', null);

  if (error || !members?.length) return 'Unknown Year';

  const counts = new Map<string, number>();
  for (const m of members) {
    const batch = yearFromRegNo(m.registration_no);
    if (batch) counts.set(batch, (counts.get(batch) ?? 0) + 1);
  }

  if (counts.size === 0) return 'Unknown Year';

  // Pick the most common batch year
  const dominant = [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0];
  return batchToLabel(dominant);
}
