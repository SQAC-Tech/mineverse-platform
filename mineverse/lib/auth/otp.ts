import { createHash } from 'crypto';

export const hashOtp = (otp: string) =>
  createHash('sha256').update(otp + process.env.JWT_SECRET!).digest('hex');

export const generateOtp = () =>
  Math.floor(100000 + Math.random() * 900000).toString();

export const maskEmail = (email: string) => {
  const [user, domain] = email.split('@');
  return `${user.slice(0, 2)}•••@${domain}`;
};

/** Event-day check in IST regardless of server timezone. */
export const isEventDay = () => {
  const istNow = new Date(Date.now() + 5.5 * 60 * 60 * 1000);
  return istNow.toISOString().slice(0, 10) === process.env.EVENT_DATE;
};
