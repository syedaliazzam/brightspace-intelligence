import CoordinatorFeeHistoryPage from "@/app/(dashboard)/coordinator/fee-history/page";

export default function AdminFeeHistoryPage() {
  return (
    <div id="admin-page-portal-root" className="relative min-h-screen">
      <CoordinatorFeeHistoryPage
        portalLabel="Admin portal"
        canEdit={false}
        classOptionsApiPath="/api/admin/class-levels"
        portalTargetId="admin-page-portal-root"
      />
    </div>
  );
}
