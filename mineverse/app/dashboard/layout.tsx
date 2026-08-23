import { getSession } from "@/lib/auth/session";
import { redirect } from "next/navigation";

/**
 * The dashboard is behind a session, and nothing else.
 *
 * This spent the run-up to the event as an unconditional `redirect()` — added
 * on the 22nd, when the screening was the only thing open and the dashboard
 * was deliberately shut. It was never reopened. Everything that points here
 * still points here: `login/verify` returns `redirect: '/dashboard'`, the login
 * card's ENTER DASHBOARD button, the proctor gate's back button, and both round
 * shells at the end of a round. All of them bounced off this line and landed on
 * the landing page.
 *
 * `getSession` stayed imported and unused the whole time, which is the tell:
 * the gate below is what this file is supposed to be.
 */
export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  if (!session) redirect('/login');

  return (
    <div className="w-full h-full">
      {children}
    </div>
  );
}
