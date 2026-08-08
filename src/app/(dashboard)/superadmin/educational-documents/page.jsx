"use client";

import EducationalDocumentsPage from "@/app/(dashboard)/coordinator/educational-documents/page.jsx";

export default function SuperAdminEducationalDocumentsPage() {
  return (
    <EducationalDocumentsPage
      allowManage={true}
      showActionsColumn={true}
      portalLabel="Super Admin portal"
      title="Educational Documents"
      description="Manage timetables, curriculum plans, material lists, and other educational resources for all classes."
    />
  );
}
