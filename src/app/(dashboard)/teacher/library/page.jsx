"use client";

import LibraryPageShell from "@/components/shared/LibraryPageShell";

export default function TeacherLibraryPage() {
  return (
    <LibraryPageShell
      allowManage={false}
      showActionsColumn={false}
      portalLabel="Teacher portal"
      title="Library"
      description="View educational resources, videos, and documents."
      cacheNamespace="teacher"
      showTableFilePreviews={false}
    />
  );
}
