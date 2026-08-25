"use client";

import { useRouter } from "next/navigation";

export default function PaymentsStudentFilterSelect({
  status,
  selectedFilter,
  verifiedCount,
  notVerifiedCount,
  hrefBase = "/coordinator/payments",
}) {
  const router = useRouter();

  return (
    <select
      value={selectedFilter}
      className="w-full rounded-2xl border border-[#2D8A6A]/20 bg-[#FAF7F0] px-4 py-3 text-sm font-semibold text-[#063F32] outline-none transition focus:border-[#2D8A6A] focus:ring-4 focus:ring-[#FFF5D6] lg:w-72"
      onChange={(event) => {
        router.push(`${hrefBase}?status=${status}&studentFilter=${event.target.value}`);
      }}
    >
      <option value="verified">Verified students ({verifiedCount})</option>
      <option value="not_verified">Not verified students ({notVerifiedCount})</option>
    </select>
  );
}

export function PaymentsStatusFilterSelect({ selectedStatus, studentFilter, counts, hrefBase = "/coordinator/payments" }) {
  const router = useRouter();

  return (
    <select
      value={selectedStatus}
      className="w-full rounded-2xl border border-[#2D8A6A]/20 bg-[#FAF7F0] px-4 py-3 text-sm font-semibold text-[#063F32] outline-none transition focus:border-[#2D8A6A] focus:ring-4 focus:ring-[#FFF5D6] lg:w-64"
      onChange={(event) => {
        router.push(`${hrefBase}?status=${event.target.value}&studentFilter=${studentFilter}`);
      }}
    >
      <option value="pending">Pending ({counts?.pending || 0})</option>
      <option value="verified">Verified ({counts?.verified || 0})</option>
      <option value="rejected">Rejected ({counts?.rejected || 0})</option>
    </select>
  );
}
