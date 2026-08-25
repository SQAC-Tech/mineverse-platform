import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { verifyPanelToken, PANEL_COOKIE } from '@/lib/panel/session';
import { getRound5Leaderboard, type TeamResources } from '@/lib/gameplay/day2/leaderboard';
import { PageTitle, Panel, Table, Empty, Pill, StatTile, Grid } from '@/components/admin/nether-ui';

/**
 * The Round 5 standings, read fresh on every load.
 *
 * Deliberately a server component with no polling: this is the screen an
 * organiser refreshes when they want the current picture, and the alternative —
 * a client that ticks every few seconds — would put the whole table through the
 * database on a timer for a round that only nineteen teams are playing.
 */
export const dynamic = 'force-dynamic';

export default async function Round5LeaderboardPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get(PANEL_COOKIE)?.value;

  if (!token || !(await verifyPanelToken(token, 'admin'))) {
    redirect('/admin/login');
  }

  const rows = await getRound5Leaderboard();
  const attempted = rows.filter((row) => row.boss_status !== 'not_attempted').length;
  const leader = rows[0];

  return (
    <>
      <PageTitle
        title="Round 5 standings"
        subtitle="Answers plus weighted resources. Wood 0.5, stone 1, iron 1.5, gold 2, emerald 2, diamond 3. Level on the score, more answers wins, then the earlier finish on the dragon."
      />

      <Grid min={200} gap={12}>
        <StatTile label="Teams" value={String(rows.length)} />
        <StatTile label="Fought the dragon" value={`${attempted} of ${rows.length}`} />
        <StatTile label="Leader" value={leader ? leader.team_code : '—'} />
        <StatTile label="Top score" value={leader ? String(leader.grand_total) : '—'} />
      </Grid>

      <Panel title="Combined">
        <Table head={['#', 'Team', 'Dragon', 'Questions', 'Answers', 'Resource pts', 'Score', 'Fight', 'Resources']}>
          {rows.length === 0 && <Empty colSpan={9}>Nobody has qualified for Day 2 yet.</Empty>}
          {rows.map((row) => (
            <tr key={row.team_code}>
              <td>{row.rank}</td>
              <td>
                <strong>{row.team_code}</strong>
                <div style={{ fontSize: 11, opacity: 0.7 }}>{row.team_name}</div>
              </td>
              <td>
                {row.boss_status === 'not_attempted'
                  ? '—'
                  : `${row.boss_correct} / ${row.boss_total || '?'}`}
              </td>
              <td>
                {row.questions_correct}
                <span style={{ opacity: 0.6 }}> of {row.questions_answered} answered</span>
              </td>
              <td>{row.total_correct}</td>
              <td>{row.resource_points}</td>
              <td>
                <strong>{row.grand_total}</strong>
              </td>
              <td>
                <Pill tone={bossTone(row.boss_status)}>{bossLabel(row.boss_status)}</Pill>
              </td>
              <td>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 10px', fontSize: 11 }}>
                  {RESOURCE_ORDER.map(([key, label]) => (
                    <span key={key} style={{ opacity: row.resources[key] > 0 ? 1 : 0.35 }}>
                      {label} <strong>{row.resources[key]}</strong>
                    </span>
                  ))}
                </div>
              </td>
            </tr>
          ))}
        </Table>
      </Panel>
    </>
  );
}

/** Shown in the order a team earns them, not alphabetically. */
const RESOURCE_ORDER: Array<[keyof TeamResources, string]> = [
  ['wood', 'W'],
  ['stone', 'S'],
  ['iron', 'Fe'],
  ['gold', 'Au'],
  ['diamond', 'Dia'],
  ['emerald', 'Em'],
  ['obsidian', 'Obs'],
];

function bossLabel(status: string) {
  if (status === 'not_attempted') return 'not fought';
  if (status === 'active') return 'in the fight';
  return status;
}

function bossTone(status: string) {
  if (status === 'won') return 'ok' as const;
  if (status === 'lost') return 'danger' as const;
  if (status === 'active') return 'live' as const;
  return 'idle' as const;
}
