import PublicEventRegistrationsPage from "@/components/public-events/PublicEventRegistrationsPage";

export default function AdminPublicEventRegistrationsPage() {
  return (
    <PublicEventRegistrationsPage
      portalLabel="Admin portal"
      title="Event registrations"
      description="Review public event registrations and their current payment verification status."
      canManage={false}
    />
  );
}
