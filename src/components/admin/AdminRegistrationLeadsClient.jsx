"use client";

import { useMemo, useState } from "react";
import RegistrationLeadFilters from "@/components/coordinator/RegistrationLeadFilters";
import RegistrationLeadsPanel from "@/components/coordinator/RegistrationLeadsPanel";
import PaginationControls from "@/components/teacher/PaginationControls";

const PAGE_SIZE = 7;

function normalizeText(value) {
  return String(value || "").trim().toLowerCase();
}

function matchesLeadSearch(lead, search) {
  const query = normalizeText(search);
  if (!query) return true;

  return [
    lead.student_name,
    lead.parent_name,
    lead.email,
    lead.phone,
    lead.city,
    lead.class_level,
    lead.program_name,
  ]
    .map((value) => normalizeText(value))
    .some((value) => value.includes(query));
}

export default function AdminRegistrationLeadsClient({
  leads = [],
  initialSearch = "",
  initialStatus = "new_lead",
  portalTargetId = "admin-page-portal-root",
}) {
  const [filters, setFilters] = useState({
    search: initialSearch,
    status: initialStatus || "new_lead",
  });
  const [page, setPage] = useState(1);

  const filteredLeads = useMemo(() => {
    const status = normalizeText(filters.status);
    return leads.filter((lead) => {
      const leadStatus = normalizeText(lead.status);
      if (status && status !== "all" && leadStatus !== status) return false;
      return matchesLeadSearch(lead, filters.search);
    });
  }, [filters.search, filters.status, leads]);

  const totalPages = Math.max(1, Math.ceil(filteredLeads.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const visibleLeads = useMemo(
    () => filteredLeads.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE),
    [filteredLeads, safePage]
  );

  function handleFilterChange(nextFilters) {
    setFilters({
      search: nextFilters?.search || "",
      status: nextFilters?.status || "all",
    });
    setPage(1);
  }

  return (
    <>
      <RegistrationLeadFilters
        initialSearch={filters.search}
        initialStatus={filters.status === "all" ? "" : filters.status}
        canSync={false}
        clientSide
        onFilterChange={handleFilterChange}
      />

      {filteredLeads.length ? (
        <section className="space-y-4">
          <RegistrationLeadsPanel
            leads={visibleLeads}
            portalTargetId={portalTargetId}
          />
          {filteredLeads.length > PAGE_SIZE ? (
            <PaginationControls
              page={safePage}
              pageSize={PAGE_SIZE}
              totalItems={filteredLeads.length}
              onPageChange={setPage}
            />
          ) : null}
        </section>
      ) : (
        <section className="rounded-[1.75rem] border border-dashed border-[#2D8A6A]/25 bg-[#FAF7F0]/80 p-10 text-center text-sm text-[#245C4F] shadow-[0_18px_60px_-36px_rgba(13,59,46,0.18)]">
          No admission records match the current filters.
        </section>
      )}
    </>
  );
}
