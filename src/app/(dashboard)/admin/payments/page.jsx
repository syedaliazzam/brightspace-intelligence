import CoordinatorPaymentsPage from "@/app/(dashboard)/coordinator/payments/page";

export default function AdminPaymentsPage({ searchParams }) {
  return (
    <CoordinatorPaymentsPage
      searchParams={searchParams}
      portalLabel="Admin portal"
      canManage={false}
      hrefBasePath="/admin/payments"
      clientSideFilters
    />
  );
}
