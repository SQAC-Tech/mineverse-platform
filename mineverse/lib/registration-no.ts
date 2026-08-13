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
