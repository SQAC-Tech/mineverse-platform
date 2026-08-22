import { describe, expect, it } from 'vitest';
import { outstandingIn } from '@/hooks/useAnswerAutosave';

/**
 * What the autosave decides to send.
 *
 * The hook exists because an answer typed and never explicitly saved reached the
 * server nowhere: it sat in `localStorage` until the round's `ends_at` passed,
 * after which the submission endpoints refuse the round and nothing — not the
 * team, not an organiser — can hand it in.
 *
 * This is the half of it worth pinning. Sending too little loses work, which is
 * the bug being fixed; sending too much re-posts unchanged answers every 25
 * seconds, which climbs the revision counter on every question for the whole
 * round and makes the submissions console unreadable.
 */
describe('choosing what to send', () => {
  it('sends an answer the server has not seen', () => {
    expect(outstandingIn({ q1: 'stack' }, {})).toEqual([['q1', 'stack']]);
  });

  it('does not send the same text twice', () => {
    // The property that keeps a 25-second timer from inflating every revision.
    expect(outstandingIn({ q1: 'stack' }, { q1: 'stack' })).toEqual([]);
  });

  it('sends again once the text changes', () => {
    expect(outstandingIn({ q1: 'queue' }, { q1: 'stack' })).toEqual([['q1', 'queue']]);
  });

  it('ignores whitespace-only edits', () => {
    // Trimmed on both sides of the comparison, so tabbing through a field and
    // adding a trailing space is not a revision.
    expect(outstandingIn({ q1: '  stack  ' }, { q1: 'stack' })).toEqual([]);
  });

  it('sends the trimmed text, not what is in the box', () => {
    expect(outstandingIn({ q1: '  stack\n' }, {})).toEqual([['q1', 'stack']]);
  });

  it('never sends an empty answer', () => {
    // `upsertTeamSubmission` would reject it, and a blank submission row would
    // make an unanswered question look answered on the console.
    expect(outstandingIn({ q1: '', q2: '   ', q3: '\n\t' }, {})).toEqual([]);
  });

  it('carries every changed question, not just the open one', () => {
    // A team that edits three answers and closes the laptop must lose none of
    // them, so a flush is not scoped to whatever is on screen.
    const out = outstandingIn(
      { q1: 'a', q2: 'b', q3: 'c' },
      { q2: 'b' },
    );
    expect(out.map(([id]) => id).sort()).toEqual(['q1', 'q3']);
  });

  it('handles an empty round without complaining', () => {
    expect(outstandingIn({}, {})).toEqual([]);
  });
});
