import { getSession } from "@/lib/auth/session";
import { redirect } from "next/navigation";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Always redirect to landing page (devs and users included)
  redirect('/');

  return (
    <div className="w-full h-full">
      {children}
    </div>
  );
}
