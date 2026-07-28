import PublicEventsManagementPage from "@/components/public-events/PublicEventsManagementPage";

export default function TeacherPublicEventsPage() {
  return (
    <PublicEventsManagementPage
      portalLabel="Teacher portal"
      title="Public events"
      description="View the public events calendar and review event timings relevant to the LMS schedule."
      canManage={false}
      showRecords={false}
    />
  );
}
