'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

interface QuestionPayload {
  id: string;
  prompt: string;
  content: any;
}

export function FinalBossUI() {
  const [status, setStatus] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [attempting, setAttempting] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [questions, setQuestions] = useState<QuestionPayload[] | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [timeLeft, setTimeLeft] = useState<number>(0);
  const router = useRouter();

  const fetchStatus = async () => {
    try {
      const res = await fetch('/api/team/day2/status');
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setStatus(data);
          
          if (data.final_boss?.last_attempt?.status === 'active') {
             setQuestions(data.final_boss.last_attempt.question_payload.questions);
          } else if (data.final_boss?.last_attempt?.status === 'lost') {
             const cooldownUntil = new Date(data.final_boss.last_attempt.cooldown_until).getTime();
             const now = Date.now();
             if (cooldownUntil > now) {
                setTimeLeft(Math.ceil((cooldownUntil - now) / 1000));
             }
          }
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(() => {
      if (!questions) fetchStatus();
      
      setTimeLeft(prev => {
        if (prev <= 1) return 0;
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [questions]);

  const handleStartAttempt = async () => {
    setAttempting(true);
    setError('');
    try {
      const res = await fetch('/api/team/final-boss/attempts', { method: 'POST' });
      const data = await res.json();
      if (res.status === 503) {
         setError('Final Boss questions are not available yet. Please wait for organizers to seed the event.');
      } else if (data.success) {
        setQuestions(data.payload.questions);
      } else {
        setError(data.error || 'Failed to start attempt');
      }
    } catch (e) {
      setError('An unexpected error occurred');
    } finally {
      setAttempting(false);
    }
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    setError('');
    try {
      const answersList = Object.entries(answers).map(([question_id, answer_text]) => ({
        question_id,
        answer_text
      }));
      
      const res = await fetch('/api/team/final-boss/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ answers: answersList }),
      });
      const data = await res.json();
      
      if (data.success) {
        if (data.result === 'won') {
           // Reload page to show victory
           window.location.reload();
        } else {
           setQuestions(null);
           setAnswers({});
           const cooldownUntil = new Date(data.cooldown_until).getTime();
           setTimeLeft(Math.ceil((cooldownUntil - Date.now()) / 1000));
        }
      } else {
        setError(data.error || 'Failed to submit attempt');
      }
    } catch (e) {
      setError('An unexpected error occurred');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <div>Loading...</div>;
  if (!status) return <div>Failed to load boss status</div>;

  const { portal, final_boss } = status;

  if (!portal.is_repaired) {
    return (
      <div className="p-8 text-center">
        <h1 className="text-3xl font-bold mb-4 text-red-500">Access Denied</h1>
        <p>You must repair the Ancient Nether Portal first.</p>
        <button onClick={() => router.push('/portal')} className="mt-4 px-4 py-2 bg-blue-600 rounded">Go to Portal</button>
      </div>
    );
  }

  if (final_boss?.last_attempt?.status === 'won') {
     return (
        <div className="p-8 text-center max-w-3xl mx-auto space-y-6">
           <h1 className="text-5xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-600">
              ENDER DRAGON DEFEATED!
           </h1>
           <p className="text-xl text-green-400">You have successfully completed the Final Boss Challenge.</p>
           <p className="text-gray-300 mt-4">Please wait while the organizers certify the results.</p>
        </div>
     );
  }

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <h1 className="text-4xl font-bold mb-8 text-purple-400">The End - Final Boss</h1>
      
      {error && <div className="p-4 bg-red-900/50 border border-red-500 text-red-200 rounded">{error}</div>}

      {!questions ? (
        <div className="flex flex-col items-center gap-6 p-12 bg-slate-900 rounded-xl border border-purple-900/50">
          <p className="text-xl text-gray-300">The Ender Dragon awaits.</p>
          {timeLeft > 0 ? (
            <div className="text-center space-y-2">
               <p className="text-red-400 font-bold text-lg">ON COOLDOWN</p>
               <div className="text-4xl font-mono">{timeLeft}s</div>
               <p className="text-sm text-gray-400">You must wait before attempting again.</p>
            </div>
          ) : (
            <button 
              onClick={handleStartAttempt}
              disabled={attempting}
              className="px-8 py-4 bg-red-700 hover:bg-red-600 disabled:opacity-50 text-white font-bold text-xl rounded shadow-[0_0_15px_rgba(220,38,38,0.5)] transition"
            >
              {attempting ? 'Starting...' : 'CHALLENGE THE BOSS'}
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-8">
           <div className="p-4 bg-red-950/30 border border-red-900 rounded">
             <p className="text-red-400 font-bold">WARNING: If you fail this attempt, you will be placed on a 3-minute cooldown.</p>
           </div>
           
           {questions.map((q, i) => (
             <div key={q.id} className="p-6 bg-slate-900 rounded border border-slate-700">
               <h3 className="text-lg font-bold mb-4">Question {i + 1}</h3>
               <div className="prose prose-invert mb-6" dangerouslySetInnerHTML={{ __html: q.prompt }} />
               <textarea
                 className="w-full p-4 bg-slate-950 border border-slate-700 rounded font-mono text-sm"
                 rows={6}
                 placeholder="Enter your answer/code here..."
                 value={answers[q.id] || ''}
                 onChange={e => setAnswers({ ...answers, [q.id]: e.target.value })}
               />
             </div>
           ))}
           
           <div className="flex justify-end">
             <button
                onClick={handleSubmit}
                disabled={submitting}
                className="px-8 py-4 bg-green-600 hover:bg-green-500 text-white font-bold text-xl rounded shadow-lg transition"
             >
                {submitting ? 'Submitting...' : 'SUBMIT ATTACK'}
             </button>
           </div>
        </div>
      )}
    </div>
  );
}
