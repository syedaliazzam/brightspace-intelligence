"use client";

import { useMemo, useState } from "react";
import PaymentVerificationTable from "@/components/coordinator/PaymentVerificationTable";
import PaginationControls from "@/components/teacher/PaginationControls";

const PAGE_SIZE = 7;

function normalizeStatus(value) {
  return String(value || "").trim().toLowerCase();
}

function isStudentMatched(item, studentFilter) {
  const isVerified = Boolean(item?.is_lms_enrolled);
  return studentFilter === "not_verified" ? !isVerified : isVerified;
}

export default function PaymentsQueueClient({
  items = [],
  initialStatus = "pending",
  initialStudentFilter = "verified",
  canManage = true,
}) {
  const [status, setStatus] = useState(initialStatus);
  const [studentFilter, setStudentFilter] = useState(initialStudentFilter);
  const [page, setPage] = useState(1);

  const statusItems = useMemo(
    () => items.filter((item) => normalizeStatus(item.status) === status),
    [items, status]
  );

  const verifiedCount = useMemo(
    () => statusItems.filter((item) => Boolean(item.is_lms_enrolled)).length,
    [statusItems]
  );
  const notVerifiedCount = Math.max(statusItems.length - verifiedCount, 0);

  const counts = useMemo(() => {
    const scopedItems = items.filter((item) => isStudentMatched(item, studentFilter));
    return {
      pending: scopedItems.filter((item) => normalizeStatus(item.status) === "pending").length,
      verified: scopedItems.filter((item) => normalizeStatus(item.status) === "verified").length,
      rejected: scopedItems.filter((item) => normalizeStatus(item.status) === "rejected").length,
    };
  }, [items, studentFilter]);

  const filteredItems = useMemo(
    () => statusItems.filter((item) => isStudentMatched(item, studentFilter)),
    [statusItems, studentFilter]
  );

  const totalPages = Math.max(1, Math.ceil(filteredItems.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const visibleItems = useMemo(
    () => filteredItems.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE),
    [filteredItems, safePage]
  );

  function updateStudentFilter(nextFilter) {
    setStudentFilter(nextFilter === "not_verified" ? "not_verified" : "verified");
    setPage(1);
  }

  function updateStatus(nextStatus) {
    setStatus(["pending", "verified", "rejected"].includes(nextStatus) ? nextStatus : "pending");
    setPage(1);
  }

  return (
    <>
      <div className="flex flex-col gap-3 rounded-[2rem] border border-[#2D8A6A]/15 bg-white/90 p-5 shadow-[0_18px_60px_-36px_rgba(13,59,46,0.16)] lg:flex-row lg:items-center">
        <select
          value={studentFilter}
          onChange={(event) => updateStudentFilter(event.target.value)}
          className="w-full rounded-2xl border border-[#2D8A6A]/20 bg-[#FAF7F0] px-4 py-3 text-sm font-semibold text-[#063F32] outline-none transition focus:border-[#2D8A6A] focus:ring-4 focus:ring-[#FFF5D6] lg:w-72"
        >
          <option value="verified">Verified students ({verifiedCount})</option>
          <option value="not_verified">Not verified students ({notVerifiedCount})</option>
        </select>

        <select
          value={status}
          onChange={(event) => updateStatus(event.target.value)}
          className="w-full rounded-2xl border border-[#2D8A6A]/20 bg-[#FAF7F0] px-4 py-3 text-sm font-semibold text-[#063F32] outline-none transition focus:border-[#2D8A6A] focus:ring-4 focus:ring-[#FFF5D6] lg:w-64"
        >
          <option value="pending">Pending ({counts.pending})</option>
          <option value="verified">Verified ({counts.verified})</option>
          <option value="rejected">Rejected ({counts.rejected})</option>
        </select>
      </div>

      {filteredItems.length ? (
        <section className="space-y-4">
          <PaymentVerificationTable items={visibleItems} canManage={canManage} />
          {filteredItems.length > PAGE_SIZE ? (
            <PaginationControls
              page={safePage}
              pageSize={PAGE_SIZE}
              totalItems={filteredItems.length}
              onPageChange={setPage}
            />
          ) : null}
        </section>
      ) : (
        <section className="rounded-[1.75rem] border border-dashed border-[#2D8A6A]/25 bg-[#FAF7F0]/80 p-10 text-center text-sm text-[#245C4F] shadow-[0_18px_60px_-36px_rgba(13,59,46,0.18)]">
          No payment submissions match this filter.
        </section>
      )}
    </>
  );
}
