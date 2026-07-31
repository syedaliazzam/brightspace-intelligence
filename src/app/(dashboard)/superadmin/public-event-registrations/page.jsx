import PublicEventRegistrationsPage from "@/components/public-events/PublicEventRegistrationsPage";

export default function SuperAdminPublicEventRegistrationsPage() {
  return (
    <PublicEventRegistrationsPage
      portalLabel="Super Admin portal"
      title="Event registrations"
      description="Review public event registrations and their verification progress from the super admin portal."
      canManage
    />
  );
}
