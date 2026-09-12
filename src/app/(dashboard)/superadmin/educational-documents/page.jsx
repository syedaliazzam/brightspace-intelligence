"use client";

import EducationalDocumentsPage from "@/app/(dashboard)/coordinator/educational-documents/page.jsx";

export default function SuperAdminEducationalDocumentsPage() {
  return (
    <div id="superadmin-educational-documents-portal-root" className="relative min-h-screen">
      <EducationalDocumentsPage
        allowManage={true}
        showActionsColumn={true}
        portalLabel="Super Admin portal"
        title="Educational Documents"
        description="Manage timetables, curriculum plans, material lists, and other educational resources for all classes."
        modalPortalTargetId="superadmin-educational-documents-portal-root"
        modalPageScoped={true}
        classOptionsApiPath="/api/admin/class-levels"
      />
    </div>
  );
}
