import { describe, expect, it } from 'vitest';
import { registrationSchema } from '../../../lib/validation/schemas';

/**
 * Regression guard for the "Complete the captcha" bug: the form's turnstile_token
 * value was never written when the widget solved, so zodResolver rejected the submit
 * before onSubmit ran — the captcha looked solved but the button reported it wasn't.
 */
const collegeDomain = process.env.NEXT_PUBLIC_COLLEGE_EMAIL_DOMAIN || '@college.edu.in';

// Solo entries are rejected, so the minimum valid team is a duo.
function formValues(turnstileToken: string) {
  return {
    honeypot: '' as const,
    challenge_id: '11111111-1111-4111-8111-111111111111',
    verification_token: '22222222-2222-4222-8222-222222222222',
    turnstile_token: turnstileToken,
    team_name: 'Creepers',
    transaction_id: '415223987654',
    sender_name: 'Alex Doe',
    members: [
      {
        name: 'Alex Doe',
        email: 'alex@example.com',
        college_email: `alex${collegeDomain}`,
        phone: '9876543210',
        department: 'CSE' as const,
        registration_no: 'RA2211003011234',
        is_team_lead: true,
      },
      {
        name: 'Sam Roe',
        email: 'sam@example.com',
        college_email: `sam${collegeDomain}`,
        phone: '9876543211',
        department: 'CSE' as const,
        registration_no: 'RA2211003011235',
        is_team_lead: false,
      },
    ],
  };
}

describe('registrationSchema turnstile_token', () => {
  it('rejects the untouched default form value', () => {
    const result = registrationSchema.safeParse(formValues(''));
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((i) => i.message === 'Complete the captcha')).toBe(true);
    }
  });

  it('accepts a solved widget token', () => {
    expect(registrationSchema.safeParse(formValues('0.fake-turnstile-token')).success).toBe(true);
  });
});

describe('registrationSchema team size', () => {
  it('rejects a solo entry', () => {
    const solo = formValues('0.fake-turnstile-token');
    solo.members = [solo.members[0]];
    const result = registrationSchema.safeParse(solo);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((i) => i.message.includes('at least 2 members'))).toBe(true);
    }
  });
});

describe('registrationSchema registration_no', () => {
  it('normalises case and surrounding whitespace', () => {
    const values = formValues('0.fake-turnstile-token');
    values.members[0].registration_no = '  ra2211003011234  ';
    const result = registrationSchema.safeParse(values);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.members[0].registration_no).toBe('RA2211003011234');
    }
  });

  it.each([
    ['wrong prefix', 'RB2211003011234'],
    ['wrong year digit', 'RA1211003011234'],
    ['too short', 'RA221100301123'],
    ['too long', 'RA22110030112345'],
    ['non-numeric tail', 'RA22110030112AB'],
    ['empty', ''],
  ])('rejects %s', (_label, value) => {
    const values = formValues('0.fake-turnstile-token');
    values.members[0].registration_no = value;
    expect(registrationSchema.safeParse(values).success).toBe(false);
  });

  it('rejects the same number twice in one team', () => {
    const values = formValues('0.fake-turnstile-token');
    values.members[1].registration_no = values.members[0].registration_no;
    const result = registrationSchema.safeParse(values);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((i) => i.message.includes('Duplicate registration numbers'))).toBe(true);
    }
  });
});
