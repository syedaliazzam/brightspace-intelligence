"use client";

import LibraryPageShell from "@/components/shared/LibraryPageShell";

export default function CoordinatorLibraryPage() {
  return (
    <LibraryPageShell
      allowManage={true}
      showActionsColumn={true}
      portalLabel="Coordinator portal"
      title="Library"
      description="Manage educational resources, videos, and documents."
    />
  );
}
