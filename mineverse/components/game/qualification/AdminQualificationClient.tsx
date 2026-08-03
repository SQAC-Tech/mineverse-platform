'use client';

import { useState } from 'react';

interface TeamEligibility {
  hasIronArmor: boolean;
  hasBlazeGuardian: boolean;
  hasPvPWin: boolean;
  isEligible: boolean;
}

interface TeamGameState {
  nether_core_count: number;
  qualified_for_day2: boolean;
  qualification_frozen_at: string | null;
  elimination_reason: string | null;
}

interface TeamData {
  id: string;
  team_code: string;
  team_name: string;
  status: string;
  eligibility: TeamEligibility;
  state: TeamGameState | null;
}

interface OverviewData {
  teams: TeamData[];
}

interface ConfirmResult {
  freeze_id: string;
  qualified_count: number;
  total_eligible: number;
  total_participants: number;
  cutoff_percent: number;
  is_override: boolean;
  confirmed_by: string;
  frozen_at: string;
}

export default function AdminQualificationClient({ initialData }: { initialData: OverviewData }) {
  const [teams, setTeams] = useState<TeamData[]>(initialData.teams);
  const [cutoff, setCutoff] = useState(50);
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = async () => {
    try {
      const res = await fetch('/api/admin/qualification/overview');
      const json = await res.json();
      if (json.success) setTeams(json.data.teams || []);
    } catch {
      setError('Failed to refresh data.');
    }
  };

  const handleConfirm = async () => {
    setError(null);
    setMessage(null);
    setLoading(true);
    try {
      const res = await fetch('/api/admin/qualification/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cutoff_percent: cutoff,
          reason: reason.trim() || undefined,
        }),
      });
      const json = await res.json();

      if (json.success) {
        const data = json.data as ConfirmResult;
        setMessage(
          `Frozen: ${data.qualified_count} qualified of ${data.total_eligible} eligible across ${data.total_participants} participants (${data.cutoff_percent}%${data.is_override ? ', override' : ''}).`,
        );
        setReason('');
        await refresh();
      } else {
        setError(json.error.message || `Failed (${json.error.code}).`);
      }
    } catch {
      setError('An error occurred.');
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async () => {
    setError(null);
    try {
      const res = await fetch('/api/admin/qualification/export');
      const json = await res.json();

      if (!json.success) {
        setError(json.error.message || 'Export failed.');
        return;
      }

      const blob = new Blob([JSON.stringify(json.data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `qualified-teams-${json.data.exported_at}.json`;
      link.click();
      URL.revokeObjectURL(url);
    } catch {
      setError('An error occurred during export.');
    }
  };

  const frozenCount = teams.filter((t) => t.state?.qualification_frozen_at)?.length ?? 0;

  return (
    <div className="space-y-6">
      {error && <div className="bg-red-900/50 text-red-200 p-3 rounded text-sm">{error}</div>}
      {message && <div className="bg-emerald-900/50 text-emerald-200 p-3 rounded text-sm">{message}</div>}

      <div className="bg-slate-900 border border-slate-800 rounded-lg p-5 space-y-4">
        <div className="flex flex-wrap items-end gap-4">
          <div>
            <label className="block text-sm text-slate-400 mb-1">Qualification Cutoff (%)</label>
            <input
              type="number"
              min={1}
              max={100}
              value={cutoff}
              onChange={(e) => setCutoff(parseInt(e.target.value, 10) || 50)}
              className="bg-slate-800 border border-slate-700 rounded px-3 py-2 text-white w-32"
            />
          </div>
          <div className="flex-1 min-w-[220px]">
            <label className="block text-sm text-slate-400 mb-1">
              Override Reason (required only if eligible teams exceed the cutoff)
            </label>
            <input
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Tie-break by earliest verified win"
              className="w-full bg-slate-800 border border-slate-700 rounded px-3 py-2 text-white"
            />
          </div>
          <button
            onClick={handleConfirm}
            disabled={loading}
            className="px-4 py-2 bg-amber-500 hover:bg-amber-400 disabled:bg-slate-700 text-black rounded font-semibold transition-colors"
          >
            {loading ? 'Freezing...' : 'Confirm & Freeze'}
          </button>
          <button
            onClick={handleExport}
            disabled={loading}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-700 text-white rounded font-semibold transition-colors"
          >
            Export Qualified
          </button>
        </div>
        <p className="text-xs text-slate-500">
          {frozenCount} of {teams.length} teams frozen. Freezing writes an immutable decision to each team&apos;s
          handoff row.
        </p>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-lg overflow-hidden">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-800/50 border-b border-slate-700">
            <tr>
              <th className="p-4 font-semibold text-slate-300">Team</th>
              <th className="p-4 font-semibold text-center text-slate-300">Iron Armor</th>
              <th className="p-4 font-semibold text-center text-slate-300">Blaze Guardian</th>
              <th className="p-4 font-semibold text-center text-slate-300">PvP Win</th>
              <th className="p-4 font-semibold text-center text-slate-300">Nether Cores</th>
              <th className="p-4 font-semibold text-center text-slate-300">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {teams.map((team) => (
              <tr key={team.id} className="hover:bg-slate-800/40">
                <td className="p-4">
                  <div className="font-bold text-slate-100">{team.team_name}</div>
                  <div className="text-xs text-slate-500">{team.team_code}</div>
                </td>
                <td className="p-4 text-center">{team.eligibility.hasIronArmor ? '✅' : '❌'}</td>
                <td className="p-4 text-center">{team.eligibility.hasBlazeGuardian ? '✅' : '❌'}</td>
                <td className="p-4 text-center">{team.eligibility.hasPvPWin ? '✅' : '❌'}</td>
                <td className="p-4 text-center font-mono text-slate-200">{team.state?.nether_core_count ?? 0}</td>
                <td className="p-4 text-center">
                  {team.state?.qualification_frozen_at ? (
                    <span
                      className={`px-2 py-1 rounded text-xs font-bold ${
                        team.state.qualified_for_day2
                          ? 'bg-emerald-500/20 text-emerald-400'
                          : 'bg-red-500/20 text-red-400'
                      }`}
                    >
                      {team.state.qualified_for_day2 ? 'Qualified' : 'Eliminated'}
                    </span>
                  ) : (
                    <span className="text-slate-500 italic">Pending</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
