import PublicEventRegistrationsPage from "@/components/public-events/PublicEventRegistrationsPage";

export default function CoordinatorPublicEventRegistrationsPage() {
  return (
    <PublicEventRegistrationsPage
      portalLabel="Coordinator portal"
      title="Event registrations"
      description="Review public event registrations, verify payments, and track pending and verified participants."
      canManage
    />
  );
}
