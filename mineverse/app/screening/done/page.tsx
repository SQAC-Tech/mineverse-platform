import Link from 'next/link';
import { redirect } from 'next/navigation';
import { CheckCircle2, Mail } from 'lucide-react';
import { getSession } from '@/lib/auth/session';
import { supabaseServer } from '@/lib/supabase/server';
import '@/components/screening/screening-ui.css';
import '@/components/game/custom-round-ui/round-ui.css';

export const dynamic = 'force-dynamic';

/**
 * After the paper.
 *
 * Says nothing about the score, the number correct, or where the team stands.
 * Everything on this screen reaches the teams who have not sat the paper yet,
 * through the first player who screenshots it — a visible score would turn the
 * remaining window into a market.
 */
export default async function ScreeningDonePage({
  searchParams,
}: {
  searchParams: Promise<{ auto?: string }>;
}) {
  const session = await getSession();
  if (!session) redirect('/login');

  const params = await searchParams;
  const ranOut = params.auto === '1';

  const { data: attempt } = await (supabaseServer as any)
    .from('screening_attempts')
    .select('submitted_at, status')
    .eq('team_id', session.team_id)
    .maybeSingle();

  if (!attempt) redirect('/screening');

  const submittedAt = attempt.submitted_at
    ? new Date(attempt.submitted_at).toLocaleString('en-IN', {
        timeZone: 'Asia/Kolkata',
        day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hour12: true,
      })
    : null;

  return (
    <div className="round-ui--night scr scr__done">
      <div className="scr__backdrop" aria-hidden="true" />
      <div className="scr__shade" aria-hidden="true" />

      <div className="scr__done-card">
        <CheckCircle2 size={34} style={{ color: 'var(--rd-accent)' }} aria-hidden="true" />

        <h1>Your paper is in</h1>

        <p>
          {ranOut
            ? 'Your 30 minutes ran out, and everything you had answered was handed in automatically.'
            : 'Thanks for sitting the screening round. Your answers have been recorded.'}
        </p>

        <p>
          <Mail size={14} style={{ verticalAlign: '-2px', marginRight: 6, color: 'var(--rd-accent)' }} aria-hidden="true" />
          We will email your team if you are selected. Results go out after the window closes, so
          there is nothing more to do for now — keep an eye on the team lead&apos;s inbox.
        </p>

        <div className="scr__done-meta">
          Team {session.team_code}
          {submittedAt ? ` · submitted ${submittedAt} IST` : ''}
        </div>

        <Link href="/dashboard" className="scr__btn" style={{ textDecoration: 'none' }}>
          Back to dashboard
        </Link>
      </div>
    </div>
  );
}
