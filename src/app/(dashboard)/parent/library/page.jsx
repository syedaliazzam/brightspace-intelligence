"use client";

import LibraryPageShell from "@/components/shared/LibraryPageShell";

export default function ParentLibraryPage() {
  return (
    <LibraryPageShell
      allowManage={false}
      showActionsColumn={false}
      portalLabel="Parent portal"
      title="Library"
      description="View educational resources, videos, and documents."
    />
  );
}
