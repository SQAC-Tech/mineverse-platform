import { describe, expect, it } from 'vitest';
import {
  academicYearFromRegistrationNo,
  academicYearLabel,
  teamAcademicYear,
} from '@/lib/registration-no';

/**
 * Which paper a team sits is not the team's to decide.
 *
 * The instructions screen used to ask ("Which year are the majority of your
 * team members in?"), post the answer to `/api/screening/start`, and trust it.
 * A second-year team could answer "1st Year" and skip the code-reading variant.
 * The registration numbers already carry the admission year, so the question
 * never needed asking.
 */

const AUG_2026 = new Date('2026-08-24T09:00:00+05:30');

describe('academicYearFromRegistrationNo', () => {
  it('reads the admission year out of the prefix', () => {
    expect(academicYearFromRegistrationNo('RA2611003011234', AUG_2026)).toBe(1);
    expect(academicYearFromRegistrationNo('RA2511003011234', AUG_2026)).toBe(2);
    expect(academicYearFromRegistrationNo('RA2411003011234', AUG_2026)).toBe(3);
  });

  it('tolerates lowercase and stray whitespace', () => {
    expect(academicYearFromRegistrationNo('  ra2611003011234 ', AUG_2026)).toBe(1);
  });

  it('says nothing rather than guessing when the number is missing or malformed', () => {
    for (const value of [null, undefined, '', '   ', 'RA', 'AB2611003011234', '2611003011234']) {
      expect(academicYearFromRegistrationNo(value, AUG_2026)).toBeNull();
    }
  });

  it('rolls over with the calendar rather than needing an edit each August', () => {
    // The same student, a year later.
    expect(academicYearFromRegistrationNo('RA2611003011234', new Date('2027-08-24'))).toBe(2);
  });

  it('rejects an admission year in the future', () => {
    expect(academicYearFromRegistrationNo('RA2711003011234', AUG_2026)).toBeNull();
  });
});

describe('teamAcademicYear', () => {
  it('gives an all-first-year team the first-year paper', () => {
    expect(teamAcademicYear(['RA2611003011234', 'RA2611003011235', 'RA2611003011236'], AUG_2026)).toBe(1);
  });

  it('gives an all-second-year team the second-year paper', () => {
    expect(teamAcademicYear(['RA2511003011234', 'RA2511003011235'], AUG_2026)).toBe(2);
  });

  it('sends a mixed team up, never down', () => {
    // The rule the organizers asked for: one second year makes it a second-year
    // team. Taking the junior-most year would let seniors add a first year and
    // sit the easier paper.
    expect(teamAcademicYear(['RA2611003011234', 'RA2511003011235', 'RA2611003011236'], AUG_2026)).toBe(2);
  });

  it('does not care what order the roster comes back in', () => {
    const roster = ['RA2611003011234', 'RA2511003011235'];
    expect(teamAcademicYear(roster, AUG_2026)).toBe(teamAcademicYear([...roster].reverse(), AUG_2026));
  });

  it('treats a missing registration number as a second year', () => {
    // The fallback has to be the harder paper, or leaving the field blank
    // becomes the way to choose the easier one. Two live teams have no
    // registration numbers at all.
    expect(teamAcademicYear([null, null], AUG_2026)).toBe(2);
    expect(teamAcademicYear(['RA2611003011234', null], AUG_2026)).toBe(2);
    expect(teamAcademicYear(['not a reg no'], AUG_2026)).toBe(2);
  });

  it('treats an empty roster as a second year rather than throwing', () => {
    expect(teamAcademicYear([], AUG_2026)).toBe(2);
  });

  it('keeps a genuinely senior team above the first-year paper', () => {
    // One registered team is all RA22. They should never land on the
    // first-year paper by arithmetic accident.
    expect(teamAcademicYear(['RA2211003011234'], AUG_2026)).toBeGreaterThanOrEqual(2);
  });
});

describe('academicYearLabel', () => {
  it('collapses everything above second year into one label', () => {
    expect(academicYearLabel(1)).toBe('1st year');
    expect(academicYearLabel(2)).toBe('2nd year or above');
    expect(academicYearLabel(5)).toBe('2nd year or above');
  });
});
