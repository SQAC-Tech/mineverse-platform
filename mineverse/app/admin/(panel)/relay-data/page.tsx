import { supabaseServer } from '@/lib/supabase/server';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import RelayDataExportButton from '@/components/admin/RelayDataExportButton';

export const dynamic = 'force-dynamic';

export default async function RelayDataPage() {
  const supabase = supabaseServer;

  // Fetch attempts along with team details
  const { data: attempts, error } = await supabase
    .from('relay_screening_attempts')
    .select(`
      *,
      teams (
        team_name,
        team_code
      )
    `)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching relay data:', error);
    return (
      <div className="p-8">
        <h1 className="text-2xl font-bold mb-4">Relay Round Data</h1>
        <div className="text-red-500">Failed to load data. Please check logs.</div>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Relay Screening Data</h1>
          <p className="text-muted-foreground mt-2">
            View the progress and answers for each team in the relay round.
          </p>
        </div>
        <RelayDataExportButton attempts={attempts || []} />
      </div>

      <div className="border rounded-md">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Team</TableHead>
              <TableHead>Word</TableHead>
              <TableHead>Year 1 Answer</TableHead>
              <TableHead>Y1 Duration</TableHead>
              <TableHead>Year 2 Answer</TableHead>
              <TableHead>Y2 Duration</TableHead>
              <TableHead>Y2 Moves</TableHead>
              <TableHead>Year 3 Answer</TableHead>
              <TableHead>Y3 Duration</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Submitted At</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {attempts?.length === 0 ? (
              <TableRow>
                <TableCell colSpan={11} className="text-center h-24 text-muted-foreground">
                  No submissions yet.
                </TableCell>
              </TableRow>
            ) : (
              attempts?.map((attempt) => (
                <TableRow key={attempt.id}>
                  <TableCell>
                    <div className="font-medium">{attempt.teams?.team_name || 'Unknown Team'}</div>
                    <div className="text-xs text-muted-foreground">{attempt.teams?.team_code}</div>
                  </TableCell>
                  <TableCell className="font-mono">{attempt.word_assigned}</TableCell>
                  <TableCell>
                    {attempt.year1_answer ? (
                      <span className="font-mono text-green-600">{attempt.year1_answer}</span>
                    ) : (
                      <span className="text-muted-foreground text-sm italic">Pending</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {attempt.year1_duration_seconds ? `${attempt.year1_duration_seconds}s` : '-'}
                  </TableCell>
                  <TableCell>
                    {attempt.year2_answer ? (
                      <span className="font-mono text-green-600">{attempt.year2_answer}</span>
                    ) : (
                      <span className="text-muted-foreground text-sm italic">Pending</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {attempt.year2_duration_seconds ? `${attempt.year2_duration_seconds}s` : '-'}
                  </TableCell>
                  <TableCell>
                    {attempt.year2_moves ? attempt.year2_moves : '-'}
                  </TableCell>
                  <TableCell>
                    {attempt.year3_answer ? (
                      <span className="font-mono text-green-600">{attempt.year3_answer}</span>
                    ) : (
                      <span className="text-muted-foreground text-sm italic">Pending</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {attempt.year3_duration_seconds ? `${attempt.year3_duration_seconds}s` : '-'}
                  </TableCell>
                  <TableCell>
                    {attempt.is_completed ? (
                      <Badge variant="default" className="bg-green-600">Completed</Badge>
                    ) : (
                      <Badge variant="secondary">In Progress</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {attempt.submitted_at
                      ? new Date(attempt.submitted_at).toLocaleString()
                      : '-'}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
