import CustomEmailsPage from "@/components/coordinator/CustomEmailsPage";

export const dynamic = "force-dynamic";

export default function SuperadminCustomEmailsPage() {
  return (
    <div id="superadmin-page-portal-root" className="relative min-h-screen">
      <CustomEmailsPage
        portalLabel="Super Admin portal"
        title="Custom Emails"
        description="Send custom themed emails to public event registrations and verified LMS users."
        portalTargetId="superadmin-page-portal-root"
      />
    </div>
  );
}
