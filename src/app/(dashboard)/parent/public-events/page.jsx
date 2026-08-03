import { redirect } from "next/navigation";
import PublicEventsManagementPage from "@/components/public-events/PublicEventsManagementPage";
import { auth, roleToDashboard } from "@/lib/auth";

const ALLOWED_ROLES = new Set(["coordinator"]);

export default async function ParentPublicEventsPage() {
  const session = await auth();
  const role = String(session?.user?.role || "").toLowerCase();
  if (!session?.user || !ALLOWED_ROLES.has(role)) {
    redirect(session?.user ? roleToDashboard[role] || "/login" : "/login");
  }

  return (
    <PublicEventsManagementPage
      portalLabel="Parent portal"
      title="Public events"
      description="View the public events calendar and review upcoming event timings from the parent portal."
      apiPath="/api/public-events"
      canManage={false}
      showRecords={false}
    />
  );
}
