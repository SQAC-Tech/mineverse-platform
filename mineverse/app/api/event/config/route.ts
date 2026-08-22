import { NextResponse } from 'next/server';
import { env } from '@/lib/env';
import { isRegistrationOpen } from '@/lib/platform/settings';

// Reads a switch an organizer can flip mid-day, so it must not be cached at
// build time — a closed registration that still advertises itself as open is
// the whole failure this is meant to prevent.
export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json({
    success: true,
    data: {
      event_name: process.env.NEXT_PUBLIC_EVENT_NAME,
      event_date_display: process.env.NEXT_PUBLIC_EVENT_DATE_DISPLAY,
      event_time: process.env.NEXT_PUBLIC_EVENT_TIME,
      venue: process.env.NEXT_PUBLIC_EVENT_VENUE,
      registration_open: await isRegistrationOpen(),
      fees: { solo: env.FEE_SOLO, duo: env.FEE_DUO, trio: env.FEE_TRIO },
      contact_email: process.env.NEXT_PUBLIC_CONTACT_EMAIL,
      contact_phone: process.env.NEXT_PUBLIC_CONTACT_PHONE,
    },
  });
}
