import { redirect } from "next/navigation";
import PublicEventsManagementPage from "@/components/public-events/PublicEventsManagementPage";
import { auth, roleToDashboard } from "@/lib/auth";

const ALLOWED_ROLES = new Set(["coordinator"]);

export default async function AdminPublicEventsPage() {
  const session = await auth();
  const role = String(session?.user?.role || "").toLowerCase();
  if (!session?.user || !ALLOWED_ROLES.has(role)) {
    redirect(session?.user ? roleToDashboard[role] || "/login" : "/login");
  }

  return (
    <PublicEventsManagementPage
      portalLabel="Admin portal"
      title="Public events"
      description="View published and draft public events, along with their LMS calendar schedule."
      canManage={false}
    />
  );
}
