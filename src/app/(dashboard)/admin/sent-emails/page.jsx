import ResendEmailsPage from "@/components/coordinator/ResendEmailsPage";

export default function AdminSentEmailsPage() {
  return (
    <ResendEmailsPage
      portalLabel="Admin portal"
      title="Sent emails"
      description="Review emails sent to users through Resend, with filters and 7-row pagination in one place."
    />
  );
}
