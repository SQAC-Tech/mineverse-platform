'use client';

import { useEffect, useState } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from '@/components/ui/accordion';

export default function AdminTeamsPage() {
  const [teams, setTeams] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchTeams = async () => {
    const res = await fetch('/api/admin/teams');
    const json = await res.json();
    if (json.success) setTeams(json.data);
    setLoading(false);
  };

  useEffect(() => {
    fetchTeams();
  }, []);

  if (loading) return <div>Loading teams...</div>;

  return (
    <div className="space-y-6">
      <h2 className="text-3xl font-bold text-white tracking-tight">Teams Roster</h2>
      
      <div className="bg-slate-900 border border-slate-800 rounded-lg overflow-hidden p-4">
        <Accordion type="single" collapsible className="w-full">
          {teams.map(t => (
            <AccordionItem key={t.id} value={t.id} className="border-slate-800">
              <AccordionTrigger className="hover:no-underline hover:bg-slate-800/50 px-4 py-3 rounded-lg">
                <div className="flex flex-1 items-center justify-between pr-4">
                  <div className="flex items-center gap-4">
                    <span className="font-bold text-slate-200">{t.team_code}</span>
                    <span className="text-slate-400">{t.team_name}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {t.is_payment_verified ? (
                      <Badge className="bg-emerald-500/20 text-emerald-400">Verified</Badge>
                    ) : (
                      <Badge className="bg-amber-500/20 text-amber-400">Pending</Badge>
                    )}
                    <Badge variant="outline" className="border-slate-700 text-slate-400">{t.team_size} members</Badge>
                  </div>
                </div>
              </AccordionTrigger>
              <AccordionContent className="px-4 py-4 text-slate-300 bg-slate-950/50 rounded-b-lg">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <h4 className="font-semibold text-slate-100 mb-2 border-b border-slate-800 pb-1">Members</h4>
                    <ul className="space-y-2">
                      {t.members?.map((m: any) => (
                        <li key={m.id} className="text-sm flex justify-between items-center">
                          <div>
                            <span className="font-medium text-slate-300">{m.name}</span>
                            {m.is_team_lead && <Badge className="ml-2 bg-blue-500/20 text-blue-400 text-[10px]">Lead</Badge>}
                          </div>
                          <span className="text-slate-500 text-xs">{m.college_email}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <h4 className="font-semibold text-slate-100 mb-2 border-b border-slate-800 pb-1">Attendance Records</h4>
                    {t.attendance_records?.length > 0 ? (
                      <div className="flex flex-wrap gap-2">
                        {t.attendance_records.map((ar: any) => (
                          <Badge key={ar.checkpoint_id} className="bg-cyan-500/20 text-cyan-400">
                            Checkpoint {ar.checkpoint_id}: {ar.members_present}/{t.team_size} present
                          </Badge>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-slate-500">No attendance recorded yet.</p>
                    )}
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>
          ))}
          {teams.length === 0 && (
            <div className="text-center text-slate-500 py-8">No teams registered yet.</div>
          )}
        </Accordion>
      </div>
    </div>
  );
}
