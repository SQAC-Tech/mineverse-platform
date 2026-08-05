import { describe, expect, it } from 'vitest';
import { registrationSchema } from '../../../lib/validation/schemas';

/**
 * Regression guard for the "Complete the captcha" bug: the form's turnstile_token
 * value was never written when the widget solved, so zodResolver rejected the submit
 * before onSubmit ran — the captcha looked solved but the button reported it wasn't.
 */
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
        college_email: `alex${process.env.NEXT_PUBLIC_COLLEGE_EMAIL_DOMAIN || '@college.edu.in'}`,
        phone: '9876543210',
        department: 'CSE' as const,
        is_team_lead: true,
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
