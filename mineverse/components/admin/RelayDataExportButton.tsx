'use client';

import { Download } from 'lucide-react';

export default function RelayDataExportButton({ attempts }: { attempts: any[] }) {
  const handleDownload = () => {
    if (!attempts || attempts.length === 0) return;

    const headers = [
      'Team Name',
      'Team Code',
      'Word Assigned',
      'Year 1 Answer',
      'Y1 Duration (s)',
      'Year 2 Answer',
      'Y2 Duration (s)',
      'Y2 Moves',
      'Year 3 Answer',
      'Y3 Duration (s)',
      'Status',
      'Submitted At'
    ];
    
    const rows = attempts.map(a => [
      a.teams?.team_name || 'Unknown',
      a.teams?.team_code || 'Unknown',
      a.word_assigned || '',
      a.year1_answer || '',
      a.year1_duration_seconds || '',
      a.year2_answer || '',
      a.year2_duration_seconds || '',
      a.year2_moves || '',
      a.year3_answer || '',
      a.year3_duration_seconds || '',
      a.is_completed ? 'Completed' : 'In Progress',
      a.submitted_at ? new Date(a.submitted_at).toLocaleString() : ''
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'relay_data.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <button
      onClick={handleDownload}
      className="inline-flex items-center gap-2 bg-stone-900 hover:bg-stone-800 border border-stone-700 text-sm font-medium px-4 py-2 rounded-md transition-colors shadow-sm cursor-pointer"
    >
      <Download size={16} />
      Export CSV
    </button>
  );
}
