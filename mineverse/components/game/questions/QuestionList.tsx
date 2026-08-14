'use client';

import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Send, Check, AlertTriangle, Save } from 'lucide-react';
import { Panel, Btn, Pill, statusTone } from '@/components/admin/nether-ui';
import { payoutList, promptBlocks, questionTypeLabel } from '@/components/game/custom-round-ui/round-presentation';

interface Question {
  id: string;
  type: string;
  title?: string;
  prompt: string;
  content: unknown;
  order_index: number;
  language_options: string[];
  time_limit_seconds: number | null;
  submission_status: string | null;
  submission_revision: number | null;
  /** What a correct answer pays, straight from the question row. */
  pays?: Record<string, number>;
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

function languageKey(roundId: number, questionId: string) {
  return `mineverse:round:${roundId}:question:${questionId}:language`;
}

const FINAL_STATUSES = ['locked', 'graded', 'manual_review'];

const LANGUAGE_LABELS: Record<string, string> = {
  python: 'Python', py: 'Python', python3: 'Python',
  cpp: 'C++', 'c++': 'C++', c: 'C', java: 'Java',
};

function languageLabel(id: string) {
  return LANGUAGE_LABELS[id.toLowerCase()] ?? id;
}

export function QuestionList({ roundId, questions, onSubmitted, locked }: QuestionListProps) {
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  // The grader runs the code in whatever language is submitted, so this has to be
  // the team's choice — sending the first option always ran C++ code as Python.
  const [languages, setLanguages] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Drafts survive a reload or an accidental navigation mid-round.
  useEffect(() => {
    const loaded: Record<string, string> = {};
    const loadedLanguages: Record<string, string> = {};
    for (const question of questions) {
      loaded[question.id] = window.localStorage.getItem(draftKey(roundId, question.id)) ?? '';
      const savedLanguage = window.localStorage.getItem(languageKey(roundId, question.id));
      if (savedLanguage && question.language_options.includes(savedLanguage)) {
        loadedLanguages[question.id] = savedLanguage;
      }
    }
    setDrafts(loaded);
    setLanguages(loadedLanguages);
  }, [roundId, questions]);

  const setLanguage = (questionId: string, value: string) => {
    setLanguages((current) => ({ ...current, [questionId]: value }));
    window.localStorage.setItem(languageKey(roundId, questionId), value);
  };

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
        ? {
            question_id: question.id,
            code: draft,
            language: languages[question.id] ?? question.language_options[0] ?? null,
          }
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
            title={`Q${question.order_index} · ${question.title ?? questionTypeLabel(question.type)}`}
            actions={
              question.submission_status
                ? <Pill tone={statusTone(question.submission_status)}>
                    {question.submission_status}{question.submission_revision ? ` r${question.submission_revision}` : ''}
                  </Pill>
                : <Pill tone="idle">unanswered</Pill>
            }
          >
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10, alignItems: 'center' }}>
              <Pill tone="idle">{questionTypeLabel(question.type)}</Pill>
              {payoutList(question.pays).map(({ key, icon, label, amount }) => (
                <span
                  key={key}
                  title={`${label} on a correct answer`}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 7px',
                    border: '1px solid var(--border)', borderRadius: 999, fontSize: 10.5,
                  }}
                >
                  <img src={icon} alt="" width={11} height={11} /> +{amount} {label}
                </span>
              ))}
            </div>

            {/* A prompt is prose plus, usually, a code listing. Rendering the whole
                thing in one proportional block threw the code's alignment away. */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 10 }}>
              {promptBlocks(question.prompt).map((block, index) =>
                block.kind === 'code' ? (
                  <pre
                    key={index}
                    style={{
                      margin: 0, padding: '9px 11px', fontSize: 11.5, lineHeight: 1.55,
                      fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
                      background: 'rgb(from var(--bg-raised) r g b / 70%)',
                      border: '1px solid var(--border)', borderLeft: '3px solid var(--accent-primary)',
                      overflowX: 'auto', whiteSpace: 'pre', tabSize: 4,
                    }}
                  ><code>{block.body}</code></pre>
                ) : (
                  <p key={index} style={{ fontSize: 12, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{block.body}</p>
                ),
              )}
            </div>

            {isCode && question.language_options.length > 0 && (
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 9 }}>
                <span className="n-panel-sub">Language</span>
                <select
                  className="n-select"
                  style={{ maxWidth: 170 }}
                  value={languages[question.id] ?? question.language_options[0]}
                  disabled={disabled}
                  onChange={(e) => setLanguage(question.id, e.target.value)}
                >
                  {question.language_options.map((option) => (
                    <option key={option} value={option}>{languageLabel(option)}</option>
                  ))}
                </select>
              </label>
            )}

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
