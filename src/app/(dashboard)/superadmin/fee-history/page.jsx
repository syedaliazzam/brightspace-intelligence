import CoordinatorFeeHistoryPage from "@/app/(dashboard)/coordinator/fee-history/page";

export default function SuperAdminFeeHistoryPage() {
  return (
    <div id="superadmin-page-portal-root" className="relative min-h-screen">
      <CoordinatorFeeHistoryPage
        portalLabel="Super Admin portal"
        canEdit={true}
        classOptionsApiPath="/api/admin/class-levels"
        portalTargetId="superadmin-page-portal-root"
      />
    </div>
  );
}
