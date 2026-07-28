import PublicEventsManagementPage from "@/components/public-events/PublicEventsManagementPage";

export default function SuperAdminPublicEventsPage() {
  return (
    <PublicEventsManagementPage
      portalLabel="Super Admin portal"
      title="Public events"
      description="View public event publishing, calendar schedule, and event records from the super admin portal."
      canManage={false}
    />
  );
}
