"use client";

import { useState } from "react";
import FeeVoucherForm from "@/components/coordinator/FeeVoucherForm";
import RegistrationLeadTable from "@/components/coordinator/RegistrationLeadTable";

export default function RegistrationLeadsPanel({ leads }) {
  const [selectedLeadId, setSelectedLeadId] = useState("");

  return (
    <div className="space-y-6">
      <RegistrationLeadTable
        leads={leads}
        onCreateVoucher={(lead) => setSelectedLeadId(lead?.id || "")}
      />

      <FeeVoucherForm
        leads={leads}
        initialLeadId={selectedLeadId}
        showTrigger={false}
        onClose={() => setSelectedLeadId("")}
        onCreated={() => setSelectedLeadId("")}
      />
    </div>
  );
}
