/**
 * How a program's output is compared to an expected answer.
 *
 * Line endings and trailing spaces differ between runtimes, and between the
 * machine a team typed on and the one Piston ran on; the answer does not.
 * lib/grading/day2-round5.ts normalises in exactly this way, so a sample case
 * that passes in the editor is a case that passes when it is marked. That
 * promise is the whole reason for showing sample results at all — if the two
 * ever diverge, the editor is lying to the team.
 */
export function normalizeOutput(value: unknown): string {
  return String(value ?? '')
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((line) => line.trimEnd())
    .join('\n')
    .trim();
}
