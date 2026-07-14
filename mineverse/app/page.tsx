import { env } from '@/lib/env';
import { MinecraftLanding } from '@/components/landing/minecraft-landing';

async function getEventConfig() {
  return {
    event_name: process.env.NEXT_PUBLIC_EVENT_NAME,
    event_date_display: process.env.NEXT_PUBLIC_EVENT_DATE_DISPLAY,
    event_time: process.env.NEXT_PUBLIC_EVENT_TIME,
    venue: process.env.NEXT_PUBLIC_EVENT_VENUE,
    registration_open: process.env.NEXT_PUBLIC_REGISTRATION_OPEN === 'true',
    fees: { solo: env.FEE_SOLO, duo: env.FEE_DUO, trio: env.FEE_TRIO },
    contact_email: process.env.NEXT_PUBLIC_CONTACT_EMAIL,
    contact_phone: process.env.NEXT_PUBLIC_CONTACT_PHONE,
  };
}

export default async function Page() {
  const config = await getEventConfig();
  return <MinecraftLanding config={config} />;
}
