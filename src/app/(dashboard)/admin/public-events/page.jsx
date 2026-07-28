import PublicEventsManagementPage from "@/components/public-events/PublicEventsManagementPage";

export default function AdminPublicEventsPage() {
  return (
    <PublicEventsManagementPage
      portalLabel="Admin portal"
      title="Public events"
      description="View published and draft public events, along with their LMS calendar schedule."
      canManage={false}
    />
  );
}
