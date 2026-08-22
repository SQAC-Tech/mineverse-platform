import { env } from '@/lib/env';
import { MinecraftLanding } from '@/features/landing-registration/minecraft-landing';
import { isRegistrationOpen } from '@/lib/platform/settings';

// `registration_open` is now a switch on the admin panel rather than a build
// time constant, so this page cannot be prerendered — a statically captured
// "open" would keep inviting sign-ups after registration closed.
export const dynamic = 'force-dynamic';

async function getEventConfig() {
  return {
    event_name: process.env.NEXT_PUBLIC_EVENT_NAME,
    event_date_display: process.env.NEXT_PUBLIC_EVENT_DATE_DISPLAY,
    event_time: process.env.NEXT_PUBLIC_EVENT_TIME,
    venue: process.env.NEXT_PUBLIC_EVENT_VENUE,
    registration_open: await isRegistrationOpen(),
    fees: { solo: env.FEE_SOLO, duo: env.FEE_DUO, trio: env.FEE_TRIO },
    contact_email: process.env.NEXT_PUBLIC_CONTACT_EMAIL,
    contact_phone: process.env.NEXT_PUBLIC_CONTACT_PHONE,
  };
}

export default async function LandingPage() {
  const config = await getEventConfig();
  return <MinecraftLanding config={config} />;
}
