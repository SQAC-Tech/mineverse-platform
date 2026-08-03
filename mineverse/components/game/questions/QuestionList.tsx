'use client';

import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Send, Check, AlertTriangle, Save } from 'lucide-react';
import { Panel, Btn, Pill, statusTone } from '@/components/admin/nether-ui';

interface Question {
  id: string;
  type: string;
  prompt: string;
  content: unknown;
  order_index: number;
  language_options: string[];
  time_limit_seconds: number | null;
  submission_status: string | null;
  submission_revision: number | null;
}

interface QuestionListProps {
  roundId: number;
  questions: Question[];
  onSubmitted: () => void | Promise<void>;
  /** The round timer has run out; answers can no longer be revised. */
  locked?: boolean;
}

function draftKey(roundId: number, questionId: string) {
  return `mineverse:round:${roundId}:question:${questionId}:draft`;
}

const FINAL_STATUSES = ['locked', 'graded', 'manual_review'];

export function QuestionList({ roundId, questions, onSubmitted, locked }: QuestionListProps) {
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Drafts survive a reload or an accidental navigation mid-round.
  useEffect(() => {
    const loaded: Record<string, string> = {};
    for (const question of questions) {
      loaded[question.id] = window.localStorage.getItem(draftKey(roundId, question.id)) ?? '';
    }
    setDrafts(loaded);
  }, [roundId, questions]);

  const ordered = useMemo(() => [...questions].sort((a, b) => a.order_index - b.order_index), [questions]);

  const setDraft = (questionId: string, value: string) => {
    setDrafts((current) => ({ ...current, [questionId]: value }));
    window.localStorage.setItem(draftKey(roundId, questionId), value);
  };

  const submit = async (question: Question) => {
    setSubmitting(question.id);
    setError(null);
    try {
      const draft = drafts[question.id] ?? '';
      const isCode = question.type === 'coding' || question.type === 'code_completion';
      const body = isCode
        ? { question_id: question.id, code: draft, language: question.language_options[0] ?? null }
        : { question_id: question.id, answer_text: draft };

      const res = await fetch('/api/submissions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const json = await res.json();

      if (!json.success) {
        setError(submitErrorCopy(json.error?.code, json.error?.message));
        return;
      }

      toast.success(question.submission_status ? 'Answer revised' : 'Answer submitted');
      // Only clear the local draft once the server has it.
      window.localStorage.removeItem(draftKey(roundId, question.id));
      await onSubmitted();
    } catch {
      setError('Could not reach the server. Your draft is saved on this device.');
    } finally {
      setSubmitting(null);
    }
  };

  if (ordered.length === 0) {
    return (
      <Panel title="Questions">
        <div className="n-empty">
          No questions have been released for this round yet.
          <div style={{ marginTop: 6, opacity: 0.8 }}>They appear here the moment organizers publish them.</div>
        </div>
      </Panel>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {error && (
        <div
          style={{
            display: 'flex', gap: 8, padding: 10, fontSize: 10.5,
            background: 'rgb(from var(--accent-danger) r g b / 45%)',
            border: '1px solid #a3324a', color: '#ff9db0',
          }}
        >
          <AlertTriangle size={12} style={{ flexShrink: 0, marginTop: 1 }} /> {error}
        </div>
      )}

      {ordered.map((question) => {
        const isCode = question.type === 'coding' || question.type === 'code_completion';
        const isFinal = FINAL_STATUSES.includes(question.submission_status ?? '');
        const disabled = locked || isFinal;
        const draft = drafts[question.id] ?? '';
        const unsaved = draft.trim().length > 0;

        return (
          <Panel
            key={question.id}
            title={`Q${question.order_index} · ${question.type.replace('_', ' ')}`}
            actions={
              question.submission_status
                ? <Pill tone={statusTone(question.submission_status)}>
                    {question.submission_status}{question.submission_revision ? ` r${question.submission_revision}` : ''}
                  </Pill>
                : <Pill tone="idle">unanswered</Pill>
            }
          >
            <p style={{ fontSize: 12, marginBottom: 10, whiteSpace: 'pre-wrap' }}>{question.prompt}</p>

            <textarea
              className="n-textarea"
              style={{
                minHeight: isCode ? 180 : 90,
                fontFamily: isCode ? 'ui-monospace, SFMono-Regular, Menlo, monospace' : 'inherit',
              }}
              value={draft}
              disabled={disabled}
              onChange={(e) => setDraft(question.id, e.target.value)}
              placeholder={disabled ? 'This answer is final' : isCode ? 'Write your solution' : 'Type your answer'}
            />

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginTop: 9, flexWrap: 'wrap' }}>
              <span className="n-panel-sub" style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                {isFinal
                  ? <><Check size={11} /> Final — grading in progress</>
                  : locked
                    ? 'Round closed'
                    : unsaved
                      ? <><Save size={11} /> Draft saved on this device</>
                      : 'Nothing typed yet'}
              </span>

              <Btn
                variant="primary"
                small
                disabled={disabled || submitting === question.id || !draft.trim()}
                onClick={() => submit(question)}
              >
                <Send size={11} />
                {submitting === question.id ? 'Sending…' : question.submission_status ? 'Revise' : 'Submit'}
              </Btn>
            </div>
          </Panel>
        );
      })}
    </div>
  );
}

function submitErrorCopy(code?: string, message?: string) {
  switch (code) {
    case 'SUBMISSION_LOCKED': return 'This answer is already final and cannot be revised.';
    case 'ROUND_LOCKED': return 'The round has closed — answers are no longer accepted.';
    case 'ANSWER_REQUIRED': return 'Type an answer before submitting.';
    case 'CODE_REQUIRED': return 'Write some code before submitting.';
    case 'INVALID_LANGUAGE': return 'That language is not allowed for this question.';
    case 'QUESTION_NOT_FOUND': return 'That question is no longer available.';
    default: return message ?? 'Submission failed.';
  }
}
