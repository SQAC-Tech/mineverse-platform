export type HintResult =
  | { success: true; approach: string }
  | { success: false; code: 'HINT_PROVIDER_UNAVAILABLE' | 'QUESTION_NOT_FOUND'; message: string };

/**
 * Stable integration interface for the question-scoped Hint marketplace item.
 *
 * Dev 3 does not own question content (Dev 4 owns questions and their hints), so this
 * module only defines the contract. A hint returns an approach, never an answer, and
 * never exposes hidden tests or expected outputs. Until a Dev 4 provider is wired in,
 * requests return a documented unavailable state instead of fabricated guidance.
 */
export async function getHintApproach(questionId: string): Promise<HintResult> {
  return {
    success: false,
    code: 'HINT_PROVIDER_UNAVAILABLE',
    message: `Hint provider is not available yet for question ${questionId}.`,
  };
}
