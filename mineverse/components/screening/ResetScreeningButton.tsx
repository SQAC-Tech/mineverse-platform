'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, RefreshCw } from 'lucide-react';

export function ResetScreeningButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const handleReset = async () => {
    setLoading(true);
    try {
      // Wipes existing screening_attempts record from Supabase
      await fetch('/api/screening/reset', { method: 'POST' });
      // Force reload to screening page
      window.location.href = '/screening?reset=1';
    } catch {
      router.push('/screening');
    }
  };

  return (
    <button
      type="button"
      onClick={handleReset}
      disabled={loading}
      className="flex-1 bg-stone-950 hover:bg-stone-900 border border-purple-700 text-purple-300 font-mono font-bold py-3 px-4 rounded-xl transition-all text-xs flex items-center justify-center gap-2 cursor-pointer shadow-lg disabled:opacity-50"
    >
      {loading ? (
        <>
          <Loader2 className="w-4 h-4 animate-spin text-purple-400" />
          <span>RESETTING...</span>
        </>
      ) : (
        <>
          <RefreshCw className="w-4 h-4 text-purple-400" />
          <span>RESET & RE-TEST SCREENING</span>
        </>
      )}
    </button>
  );
}
