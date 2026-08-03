import { redirect } from "next/navigation";
import PublicEventsManagementPage from "@/components/public-events/PublicEventsManagementPage";
import { auth, roleToDashboard } from "@/lib/auth";

const ALLOWED_ROLES = new Set(["coordinator"]);

export default async function SuperAdminPublicEventsPage() {
  const session = await auth();
  const role = String(session?.user?.role || "").toLowerCase();
  if (!session?.user || !ALLOWED_ROLES.has(role)) {
    redirect(session?.user ? roleToDashboard[role] || "/login" : "/login");
  }

  return (
    <PublicEventsManagementPage
      portalLabel="Super Admin portal"
      title="Public events"
      description="View public event publishing, calendar schedule, and event records from the super admin portal."
      canManage={false}
    />
  );
}
