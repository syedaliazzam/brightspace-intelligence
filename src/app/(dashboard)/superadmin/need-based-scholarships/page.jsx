"use client";

import { NeedBasedScholarshipsPage } from "@/app/(dashboard)/coordinator/need-based-scholarships/page";

export default function SuperAdminNeedBasedScholarshipsPage() {
  return (
    <NeedBasedScholarshipsPage
      portalLabel="Super Admin portal"
      title="Scholarship records"
      description="Review Step 6 scholarship applications from the super admin portal in a read-only view."
      allowCreateVoucher={false}
    />
  );
}
