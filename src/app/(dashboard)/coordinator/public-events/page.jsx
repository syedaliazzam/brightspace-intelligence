import PublicEventsManagementPage from "@/components/public-events/PublicEventsManagementPage";

export default function CoordinatorPublicEventsPage() {
  return (
    <PublicEventsManagementPage
      portalLabel="Coordinator portal"
      title="Public events"
      description="Create public events, publish them for the website, and review their schedule inside the LMS."
      canManage
      showRecordingSync
    />
  );
}
