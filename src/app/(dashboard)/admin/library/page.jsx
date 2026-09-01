"use client";

import LibraryPageShell from "@/components/shared/LibraryPageShell";

export default function AdminLibraryPage() {
  return (
    <LibraryPageShell
      allowManage={false}
      showActionsColumn={false}
      portalLabel="Admin portal"
      title="Library"
      description="View educational resources, videos, and documents."
      cacheNamespace="admin-library"
      showTableFilePreviews={false}
      portalTargetId="admin-page-portal-root"
    />
  );
}
