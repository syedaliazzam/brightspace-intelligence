import CoordinatorPaymentsPage from "@/app/(dashboard)/coordinator/payments/page";

export default function SuperAdminPaymentsPage({ searchParams }) {
  return (
    <CoordinatorPaymentsPage
      searchParams={searchParams}
      portalLabel="Super Admin portal"
      canManage
      hrefBasePath="/superadmin/payments"
      clientSideFilters
    />
  );
}
