"use client";

import EducationalDocumentsPage from "@/app/(dashboard)/coordinator/educational-documents/page.jsx";

export default function AdminEducationalDocumentsPage() {
  return (
    <EducationalDocumentsPage
      allowManage={false}
      showActionsColumn={false}
      portalLabel="Admin portal"
      title="Educational Documents"
      description="View timetables, curriculum plans, material lists, and other educational resources."
    />
  );
}
