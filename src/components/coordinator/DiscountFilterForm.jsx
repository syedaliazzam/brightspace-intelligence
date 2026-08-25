"use client";

import { useMemo, useState } from "react";
import PaginationControls from "@/components/teacher/PaginationControls";

const PAGE_SIZE = 7;

function formatMoney(value) {
  return `PKR ${Number(value || 0).toLocaleString("en-PK")}`;
}

function formatDate(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("en-PK", { dateStyle: "medium" }).format(date);
}

function formatPercent(value) {
  const number = Number(value || 0);
  if (!Number.isFinite(number) || number <= 0) return "-";
  return `${number.toFixed(2).replace(/\.00$/, "")}%`;
}

function normalizeStatus(value) {
  const text = String(value || "").trim().toLowerCase();
  return text ? text.replace(/_/g, " ") : "-";
}

function filterDiscountRecords(items, column, search) {
  const term = String(search || "").trim().toLowerCase();
  const normalizedColumn = String(column || "all").trim().toLowerCase();
  if (!term) return items;

  return items.filter((item) => {
    const searchableMap = {
      all: [
        item.student_name,
        item.parent_name,
        item.voucher_no,
        item.class_level,
        item.voucher_type,
        normalizeStatus(item.voucher_status),
        item.monthly_fee,
        item.discount_amount,
        item.discount_percent,
        item.admission_fee_amount,
        item.scholarship_amount,
        item.total_amount,
      ],
      student: item.student_name,
      parent: item.parent_name,
      voucher: item.voucher_no,
      class: item.class_level,
      voucher_type: item.voucher_type,
      status: normalizeStatus(item.voucher_status),
    };
    const value = searchableMap[normalizedColumn] ?? searchableMap.all;
    const text = Array.isArray(value) ? value.join(" | ") : String(value || "");
    return text.toLowerCase().includes(term);
  });
}

function DiscountRecordsTable({ items }) {
  return (
    <section className="overflow-hidden rounded-[2rem] border border-[#2D8A6A]/15 bg-[linear-gradient(180deg,rgba(255,255,255,0.96)_0%,rgba(250,247,240,0.98)_100%)] shadow-[0_20px_70px_-36px_rgba(13,59,46,0.18)]">
      <div className="overflow-x-auto">
        <table className="min-w-[1580px] text-left text-sm">
          <thead className="bg-[linear-gradient(180deg,#FAF7F0_0%,#F1EADC_100%)] text-xs uppercase tracking-[0.18em] text-[#0D5C48]">
            <tr>
              <th className="min-w-44 px-6 py-4">Student</th>
              <th className="min-w-44 px-6 py-4">Parent</th>
              <th className="min-w-52 px-6 py-4">Voucher</th>
              <th className="min-w-36 px-6 py-4">Class</th>
              <th className="min-w-36 px-6 py-4">Monthly fee</th>
              <th className="min-w-32 px-6 py-4">Discount</th>
              <th className="min-w-48 px-6 py-4">Admission form amount</th>
              <th className="min-w-44 px-6 py-4">Scholarship Given Amount</th>
              <th className="min-w-36 px-6 py-4">Total</th>
              <th className="min-w-36 px-6 py-4">Type</th>
              <th className="min-w-36 px-6 py-4">Due date</th>
              <th className="min-w-32 px-6 py-4">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#F1EADC]">
            {items.map((item) => (
              <tr key={item.id}>
                <td className="px-6 py-4 font-semibold text-[#063F32]">{item.student_name}</td>
                <td className="px-6 py-4 text-[#245C4F]">{item.parent_name}</td>
                <td className="px-6 py-4 font-semibold text-[#063F32]">{item.voucher_no}</td>
                <td className="px-6 py-4 text-[#245C4F]">{item.class_level}</td>
                <td className="px-6 py-4 font-semibold text-[#063F32]">{formatMoney(item.monthly_fee)}</td>
                <td className="px-6 py-4">
                  <p className="font-semibold text-[#063F32]">{formatMoney(item.discount_amount)}</p>
                  <p className="mt-1 text-xs text-[#245C4F]">{formatPercent(item.discount_percent)}</p>
                </td>
                <td className="px-6 py-4 font-semibold text-[#063F32]">{formatMoney(item.admission_fee_amount)}</td>
                <td className="px-6 py-4 font-semibold text-[#063F32]">{formatMoney(item.scholarship_amount)}</td>
                <td className="px-6 py-4 font-semibold text-[#063F32]">{formatMoney(item.total_amount)}</td>
                <td className="px-6 py-4 text-[#245C4F]">{item.voucher_type}</td>
                <td className="px-6 py-4 text-[#245C4F]">{formatDate(item.due_date)}</td>
                <td className="px-6 py-4">
                  <span className="inline-flex rounded-full bg-[#EAF6EF] px-3 py-1 text-xs font-semibold capitalize text-[#0D5C48]">
                    {normalizeStatus(item.voucher_status)}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export default function DiscountFilterForm({ columnOptions, items = [] }) {
  const [selectedColumn, setSelectedColumn] = useState("all");
  const [searchValue, setSearchValue] = useState("");
  const [verificationFilter, setVerificationFilter] = useState("verified");
  const [page, setPage] = useState(1);

  const verifiedCount = useMemo(() => items.filter((item) => Boolean(item.is_lms_enrolled)).length, [items]);
  const notVerifiedCount = Math.max(items.length - verifiedCount, 0);
  const filteredItems = useMemo(() => {
    const verificationFilteredItems = items.filter((item) => {
      const isVerified = Boolean(item.is_lms_enrolled);
      if (verificationFilter === "verified") return isVerified;
      return !isVerified;
    });
    return filterDiscountRecords(verificationFilteredItems, selectedColumn, searchValue);
  }, [items, selectedColumn, searchValue, verificationFilter]);
  const visibleItems = filteredItems.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const totalDiscount = filteredItems.reduce((sum, item) => sum + Number(item.discount_amount || 0), 0);

  return (
    <>
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div className="rounded-[1.75rem] border border-[#2D8A6A]/15 bg-white/90 p-5 shadow-[0_18px_60px_-36px_rgba(13,59,46,0.16)]">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#0D5C48]">Discount vouchers</p>
          <p className="mt-3 text-3xl font-semibold text-[#063F32]">{filteredItems.length}</p>
        </div>
        <div className="rounded-[1.75rem] border border-[#2D8A6A]/15 bg-white/90 p-5 shadow-[0_18px_60px_-36px_rgba(13,59,46,0.16)]">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#0D5C48]">Total discount</p>
          <p className="mt-3 text-3xl font-semibold text-[#063F32]">{formatMoney(totalDiscount)}</p>
        </div>
      </section>

      <section className="rounded-[2rem] border border-[#2D8A6A]/15 bg-white/90 p-5 shadow-[0_18px_60px_-36px_rgba(13,59,46,0.16)]">
        <div className="grid gap-3 lg:grid-cols-[260px_260px_minmax(0,1fr)]">
          <select
            value={verificationFilter}
            onChange={(event) => {
              setVerificationFilter(event.target.value);
              setPage(1);
            }}
            className="w-full rounded-2xl border border-[#2D8A6A]/20 bg-[#FAF7F0] px-4 py-3 text-sm font-semibold text-[#063F32] outline-none transition focus:border-[#2D8A6A] focus:ring-4 focus:ring-[#FFF5D6]"
          >
            <option value="verified">Verified students ({verifiedCount})</option>
            <option value="not_verified">Not verified students ({notVerifiedCount})</option>
          </select>
          <select
            value={selectedColumn}
            onChange={(event) => {
              setSelectedColumn(event.target.value);
              setPage(1);
            }}
            className="w-full rounded-2xl border border-[#2D8A6A]/20 bg-[#FAF7F0] px-4 py-3 text-sm font-semibold text-[#063F32] outline-none transition focus:border-[#2D8A6A] focus:ring-4 focus:ring-[#FFF5D6]"
          >
            {columnOptions.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
          <input
            value={searchValue}
            onChange={(event) => {
              setSearchValue(event.target.value);
              setPage(1);
            }}
            placeholder={`Search in ${columnOptions.find((option) => option.value === selectedColumn)?.label || "selected column"}`}
            className="w-full rounded-2xl border border-[#2D8A6A]/20 bg-[#FAF7F0] px-4 py-3 text-sm text-[#063F32] outline-none transition focus:border-[#2D8A6A] focus:ring-4 focus:ring-[#FFF5D6]"
          />
        </div>
      </section>

      {filteredItems.length ? (
        <section className="space-y-4">
          <DiscountRecordsTable items={visibleItems} />
          {filteredItems.length > PAGE_SIZE ? (
            <PaginationControls
              page={page}
              pageSize={PAGE_SIZE}
              totalItems={filteredItems.length}
              onPageChange={setPage}
            />
          ) : null}
        </section>
      ) : (
        <section className="rounded-[1.75rem] border border-dashed border-[#2D8A6A]/25 bg-[#FAF7F0]/80 p-10 text-center text-sm text-[#245C4F] shadow-[0_18px_60px_-36px_rgba(13,59,46,0.18)]">
          No monthly fee discount records found.
        </section>
      )}
    </>
  );
}
