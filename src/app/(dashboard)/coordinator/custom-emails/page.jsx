import CustomEmailsPage from "@/components/coordinator/CustomEmailsPage";

export const dynamic = "force-dynamic";

export default function CoordinatorCustomEmailsPage() {
  return (
    <CustomEmailsPage
      portalLabel="Coordinator portal"
      title="Custom Emails"
      description="Send custom themed emails to public event registrations and verified LMS users."
      portalTargetId="coordinator-page-portal-root"
    />
  );
}
