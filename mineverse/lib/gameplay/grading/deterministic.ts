/**
 * Deterministic answer checking shared by guardian battles, PvP packs, and the
 * Dev 5 grading run. Expected answers live in `questions.expected_answer` and are
 * never sent to a client.
 *
 * Supported shapes:
 *   "12"                                  - plain scalar
 *   { "value": "12" }                     - single accepted answer
 *   { "any_of": ["12", "twelve"] }        - any accepted answer
 *   { "value": "12", "exact": true }      - case/whitespace sensitive
 */
export type ExpectedAnswer =
  | string
  | number
  | {
      value?: string | number;
      any_of?: Array<string | number>;
      exact?: boolean;
    }
  | null
  | undefined;

function normalize(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, ' ');
}

function matches(submitted: string, candidate: string | number, exact: boolean) {
  const expected = String(candidate);
  return exact ? submitted.trim() === expected.trim() : normalize(submitted) === normalize(expected);
}

/**
 * Returns null when the question has no deterministic key — that answer needs the
 * rubric/manual path and must never be auto-scored as wrong.
 */
export function checkDeterministicAnswer(
  submitted: string | null | undefined,
  expected: ExpectedAnswer,
): boolean | null {
  if (expected === null || expected === undefined) return null;
  if (submitted === null || submitted === undefined) return false;

  if (typeof expected === 'string' || typeof expected === 'number') {
    return matches(submitted, expected, false);
  }

  const exact = expected.exact === true;

  if (Array.isArray(expected.any_of) && expected.any_of.length > 0) {
    return expected.any_of.some((candidate) => matches(submitted, candidate, exact));
  }

  if (expected.value !== undefined && expected.value !== null) {
    return matches(submitted, expected.value, exact);
  }

  return null;
}

export function hasDeterministicKey(expected: ExpectedAnswer): boolean {
  if (expected === null || expected === undefined) return false;
  if (typeof expected === 'string' || typeof expected === 'number') return true;
  if (Array.isArray(expected.any_of) && expected.any_of.length > 0) return true;
  return expected.value !== undefined && expected.value !== null;
}
