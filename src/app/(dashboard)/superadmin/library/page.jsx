"use client";

import LibraryPageShell from "@/components/shared/LibraryPageShell";

export default function SuperAdminLibraryPage() {
  return (
    <LibraryPageShell
      allowManage={true}
      showActionsColumn={true}
      portalLabel="Super Admin portal"
      title="Library"
      description="Manage educational resources, videos, and documents."
      cacheNamespace="superadmin-library"
    />
  );
}
