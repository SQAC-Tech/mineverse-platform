import { createHash } from 'crypto';

export const hashOtp = (otp: string) =>
  createHash('sha256').update(otp + process.env.JWT_SECRET!).digest('hex');

export const generateOtp = () =>
  Math.floor(100000 + Math.random() * 900000).toString();

export const maskEmail = (email: string) => {
  const [user, domain] = email.split('@');
  return `${user.slice(0, 2)}•••@${domain}`;
};

/** Today's date in IST as YYYY-MM-DD, regardless of the server's timezone. */
export const istDateString = (now: Date = new Date()) =>
  new Date(now.getTime() + 5.5 * 60 * 60 * 1000).toISOString().slice(0, 10);

/** Event-day check in IST regardless of server timezone. */
export const isEventDay = (now: Date = new Date()) =>
  istDateString(now) === process.env.EVENT_DATE;

/**
 * The screening qualifier is not on event day.
 *
 * It runs ahead of the event — teams log in, sit the paper, and the shortlist
 * decides who turns up. `EVENT_DATE` alone locked those teams out of their own
 * qualifier, because the login gate read it as the only day anyone may log in.
 * Optional: unset means the gate behaves exactly as it did.
 */
export const isScreeningDay = (now: Date = new Date()) =>
  Boolean(process.env.SCREENING_DATE) && istDateString(now) === process.env.SCREENING_DATE;
