import { redirect } from "next/navigation";
import InternalEventsPage from "@/components/internal-events/InternalEventsPage";
import { auth, roleToDashboard } from "@/lib/auth";

const ALLOWED_ROLES = new Set(["coordinator"]);

export default async function SuperAdminInternalEventsPage() {
  const session = await auth();
  const role = String(session?.user?.role || "").toLowerCase();
  if (!session?.user || !ALLOWED_ROLES.has(role)) {
    redirect(session?.user ? roleToDashboard[role] || "/login" : "/login");
  }

  return <InternalEventsPage portalLabel="Super admin portal" canCreate />;
}
