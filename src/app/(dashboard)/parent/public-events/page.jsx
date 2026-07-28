import PublicEventsManagementPage from "@/components/public-events/PublicEventsManagementPage";

export default function ParentPublicEventsPage() {
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
