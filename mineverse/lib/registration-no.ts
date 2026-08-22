/**
 * SRM registration numbers: "RA" + 13 digits, 15 characters in total, e.g.
 * RA2611003011234.
 *
 * The first four characters encode the admission year — a first-year in 2026
 * is RA26, a second-year is RA25, and so on. That makes the year a dropdown
 * and leaves the student typing only the 11 digits that actually vary, which
 * is both faster and much harder to fluff than typing all 15.
 *
 * Client-safe: no env, no zod, no server imports.
 */

/** Mirrors the `members_registration_no_format` CHECK constraint. */
export const REGISTRATION_NO = /^RA2\d{12}$/;

export const REG_NO_PREFIX_LENGTH = 4;
export const REG_NO_SUFFIX_LENGTH = 11;

export type RegistrationYear = {
  /** e.g. "1st year" */
  label: string;
  /** e.g. "RA26" */
  prefix: string;
};

/** The event is open to first and second years only. */
const ORDINALS = ['1st', '2nd'];

/**
 * Admission-year prefixes for the eligible years, newest first — in 2026 that
 * is 1st year → RA26 and 2nd year → RA25. Derived from the current year so
 * this does not need editing every August.
 */
export function registrationYears(now: Date = new Date()): RegistrationYear[] {
  const currentYear = now.getFullYear();
  return ORDINALS.map((ordinal, i) => ({
    label: `${ordinal} year`,
    prefix: `RA${String(currentYear - i).slice(-2)}`,
  }));
}

/** Splits a stored number into the year prefix and the typed digits. */
export function splitRegistrationNo(value: string) {
  const clean = (value ?? '').trim().toUpperCase();
  return {
    prefix: clean.slice(0, REG_NO_PREFIX_LENGTH),
    suffix: clean.slice(REG_NO_PREFIX_LENGTH),
  };
}

/** Recombines a year prefix with typed digits, dropping anything non-numeric. */
export function joinRegistrationNo(prefix: string, suffix: string) {
  const digits = (suffix ?? '').replace(/\D/g, '').slice(0, REG_NO_SUFFIX_LENGTH);
  return `${prefix ?? ''}${digits}`;
}

/* --------------------------------------------------------- academic year */

/**
 * Which year a registration number puts a student in, or null if it says nothing.
 *
 * "RA" + the two-digit admission year, so in 2026 an RA26 is a first year and an
 * RA25 is a second. Derived from the clock rather than a table so it does not
 * need editing every August — the same reason `registrationYears` is a function.
 *
 * Returns a number rather than a label because the caller has to compare years,
 * and comparing "2nd year" to "1st year" as strings is how a paper gets handed
 * to the wrong team.
 */
export function academicYearFromRegistrationNo(
  registrationNo: string | null | undefined,
  now: Date = new Date(),
): number | null {
  const clean = (registrationNo ?? '').trim().toUpperCase();
  if (!/^RA\d{2}/.test(clean)) return null;

  const admissionYear = 2000 + Number(clean.slice(2, 4));
  const year = now.getFullYear() - admissionYear + 1;
  return year >= 1 ? year : null;
}

/**
 * The year a team sits the screening as: its most senior member's.
 *
 * A mixed team is a second-year team. The paper is the same length either way —
 * what changes is that second years get the code-reading variant — so the rule
 * has to be the one that cannot be gamed. Taking the junior-most year would let
 * a team of seniors add one first year and sit the easier paper; taking the
 * senior-most costs an all-first-year team nothing, because there is nobody
 * senior to raise it.
 *
 * A member whose registration number is missing or unreadable counts as a second
 * year for the same reason: the fallback has to be the harder paper, or "leave
 * the field blank" becomes the way to choose it. Two registered teams have no
 * registration numbers at all, so this branch is live, not theoretical.
 */
export function teamAcademicYear(
  registrationNos: Array<string | null | undefined>,
  now: Date = new Date(),
): number {
  if (registrationNos.length === 0) return 2;

  return registrationNos.reduce<number>((mostSenior, registrationNo) => {
    const year = academicYearFromRegistrationNo(registrationNo, now) ?? 2;
    return Math.max(mostSenior, year);
  }, 1);
}

/**
 * How the team's year is shown to the team.
 *
 * Everything above second year collapses into one label: the event is open to
 * first and second years, so a third year on the roster is a registration to
 * query, not a third paper to write.
 */
export function academicYearLabel(year: number): string {
  return year <= 1 ? '1st year' : '2nd year or above';
}
