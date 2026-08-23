/**
 * Turns a grading summary from the section endpoint into one line of feedback.
 *
 * Answers are now marked and paid the instant a section is handed in, so the
 * hand-in toast is the moment a team learns how they did. Saying only "these
 * answers are final" while their inventory silently changes behind the panel
 * makes the payout look like it came from nowhere.
 *
 * What is deliberately not said: which questions were right. The round is still
 * running for everybody else in the hall, and per-question feedback handed out
 * at hand-in travels down the row.
 */

export interface SectionGrading {
  graded: number;
  correct: number;
  partial: number;
  manual_review: number;
  awarded: Record<string, number>;
}

function earnedPhrase(awarded: Record<string, number>): string {
  const parts = Object.entries(awarded ?? {})
    .filter(([, amount]) => typeof amount === 'number' && amount > 0)
    .sort((a, b) => b[1] - a[1])
    .map(([resource, amount]) => `+${amount} ${resource}`);

  return parts.length > 0 ? parts.join(', ') : '';
}

export function gradingMessage(grading: SectionGrading | null | undefined): string | null {
  if (!grading || grading.graded === 0) return null;

  const earned = earnedPhrase(grading.awarded);
  const scored = grading.correct + grading.partial;

  if (earned) {
    const detail = grading.partial > 0
      ? `${scored} of ${grading.graded} scored (${grading.partial} partial)`
      : `${scored} of ${grading.graded} correct`;
    return `${detail} — ${earned}`;
  }

  if (grading.manual_review > 0 && scored === 0) {
    return `${grading.manual_review} answer${grading.manual_review === 1 ? '' : 's'} sent for review.`;
  }

  return `${scored} of ${grading.graded} correct — no resources earned.`;
}
