"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { ChevronDown } from "lucide-react";
import ClientPortal from "@/components/shared/ClientPortal";
import FeeVoucherForm from "@/components/coordinator/FeeVoucherForm";
import PaginationControls from "@/components/teacher/PaginationControls";

const PAGE_SIZE = 7;

function formatDate(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

function formatMoney(value) {
  return `PKR ${Number(value || 0).toLocaleString("en-PK")}`;
}

export default function NeedBasedScholarshipsPage() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [columnFilter, setColumnFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [selectedItem, setSelectedItem] = useState(null);
  const [voucherTarget, setVoucherTarget] = useState(null);

  async function load() {
    setLoading(true);
    try {
      const response = await fetch("/api/coordinator/need-based-scholarships", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.message || "Unable to load scholarship records.");
      setItems(Array.isArray(data.items) ? data.items : []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const filteredItems = useMemo(() => {
    const term = String(search || "").trim().toLowerCase();
    const normalizedColumn = String(columnFilter || "all").trim().toLowerCase();

    return items.filter((item) => {
      const searchableMap = {
        all: [
          item.student_name,
          item.parent_name,
          item.class_level,
          item.email,
          item.phone,
          item.monthly_income,
          item.dependents_count,
          item.school_going_children_count,
          item.residence_type,
          item.guardian_employment_status,
          item.requested_amount,
          item.scholarship_amount,
          item.reason,
          item.status,
          item.voucher_created ? "voucher created" : "submitted",
        ],
        student: item.student_name,
        parent: item.parent_name,
        class: item.class_level,
        email: item.email,
        phone: item.phone,
        monthly_income: item.monthly_income,
        dependents_count: item.dependents_count,
        school_going_children_count: item.school_going_children_count,
        residence_type: item.residence_type,
        employment_status: item.guardian_employment_status,
        requested: item.requested_amount,
        scholarship_amount: item.scholarship_amount,
        status: item.voucher_created ? "voucher_created" : item.status || "submitted",
        submitted_at: item.created_at,
        reason: item.reason,
        voucher_created: item.voucher_created ? "voucher created" : "not created",
      };

      if (!term) return true;
      const searchableValue = searchableMap[normalizedColumn] ?? searchableMap.all;
      const searchText = Array.isArray(searchableValue) ? searchableValue.join(" | ") : String(searchableValue || "");
      return searchText.toLowerCase().includes(term);
    });
  }, [items, search, columnFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredItems.length / PAGE_SIZE));
  const paginatedItems = filteredItems.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  useEffect(() => {
    setPage(1);
  }, [search, columnFilter]);

  const columnOptions = [
    { label: "All columns", value: "all" },
    { label: "Student", value: "student" },
    { label: "Parent", value: "parent" },
    { label: "Class", value: "class" },
    { label: "Email", value: "email" },
    { label: "Phone", value: "phone" },
    { label: "Monthly Income", value: "monthly_income" },
    { label: "Dependents", value: "dependents_count" },
    { label: "School Children", value: "school_going_children_count" },
    { label: "Residence Type", value: "residence_type" },
    { label: "Employment Status", value: "employment_status" },
    { label: "Requested", value: "requested" },
    { label: "Scholarship Amount", value: "scholarship_amount" },
    { label: "Status", value: "status" },
    { label: "Submitted At", value: "submitted_at" },
    { label: "Reason", value: "reason" },
  ];

  const voucherLeads = voucherTarget
    ? [
        {
          id: voucherTarget.registration_id,
          student_name: voucherTarget.student_name,
          parent_name: voucherTarget.parent_name,
          class_level: voucherTarget.class_level,
          email: voucherTarget.email,
          phone: voucherTarget.phone,
          status: voucherTarget.lead_status,
          can_create_voucher: true,
        },
      ]
    : [];

  const supportingDocumentPreviewUrl = selectedItem?.supporting_document_file_path
    ? `/api/file-preview?path=${encodeURIComponent(selectedItem.supporting_document_file_path)}`
    : "";

  return (
    <div className="min-h-screen bg-[#FAF7F0]">
      <div className="relative mx-auto max-w-7xl space-y-6 px-4 py-4 sm:px-6 lg:px-8">
        <section className="relative overflow-hidden rounded-[2rem] border border-[#2D8A6A]/15 bg-[linear-gradient(135deg,rgba(13,59,46,0.98),rgba(13,92,72,0.94))] p-6 text-[#FAF7F0] shadow-[0_24px_80px_-36px_rgba(13,59,46,0.32)] sm:p-8">
          <p className="inline-flex rounded-full border border-[#E4C766]/30 bg-[#FFF5D6]/12 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.28em] text-[#FFF5D6]">
            Coordinator portal
          </p>
          <h1 className="mt-4 font-display text-3xl font-bold tracking-tight sm:text-4xl">Need based scholarship records</h1>
          <p className="mt-3 text-sm leading-7 text-[#EAF6EF] sm:text-base">
            Review Step 6 scholarship applications, inspect the financial details, and create the follow-up voucher from one place.
          </p>
        </section>

        <section className="rounded-[2rem] border border-[#2D8A6A]/15 bg-[linear-gradient(180deg,rgba(255,255,255,0.96)_0%,rgba(250,247,240,0.98)_100%)] shadow-[0_20px_70px_-36px_rgba(13,59,46,0.18)]">
          <div className="flex flex-col gap-3 border-b border-[#2D8A6A]/12 px-6 py-5 lg:flex-row lg:items-center">
            <div className="relative w-full lg:w-56">
              <select
                value={columnFilter}
                onChange={(event) => setColumnFilter(event.target.value)}
                className="w-full appearance-none rounded-2xl border border-[#2D8A6A]/20 bg-white px-4 py-3 pr-10 text-sm font-semibold text-[#063F32] outline-none transition focus:border-[#2D8A6A] focus:ring-4 focus:ring-[#FFF5D6]"
              >
                {columnOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#0D5C48]" />
            </div>
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={`Search in ${columnOptions.find((option) => option.value === columnFilter)?.label || "selected column"}`}
              className="w-full rounded-2xl border border-[#2D8A6A]/20 bg-white px-4 py-3 text-sm text-[#063F32] outline-none transition focus:border-[#2D8A6A] focus:ring-4 focus:ring-[#FFF5D6]"
            />
            <div className="shrink-0 rounded-2xl px-4 py-3 text-sm font-semibold text-[#245C4F]">
              Showing {filteredItems.length} of {items.length}
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-[linear-gradient(180deg,#FAF7F0_0%,#F1EADC_100%)] text-xs uppercase tracking-[0.18em] text-[#0D5C48]">
                <tr>
                  <th className="px-6 py-4">#</th>
                  <th className="px-6 py-4">Student</th>
                  <th className="px-6 py-4">Parent</th>
                  <th className="px-6 py-4">Class</th>
                  <th className="px-6 py-4">Email</th>
                  <th className="px-6 py-4">Phone</th>
                  <th className="px-6 py-4">Monthly Income</th>
                  <th className="px-6 py-4">Dependents</th>
                  <th className="px-6 py-4">School Children</th>
                  <th className="px-6 py-4">Residence</th>
                  <th className="px-6 py-4">Employment</th>
                  <th className="px-6 py-4">Requested</th>
                  <th className="px-6 py-4">Scholarship Amount</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4">Submitted At</th>
                  <th className="px-6 py-4">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F1EADC]">
                {paginatedItems.length ? paginatedItems.map((item, index) => (
                  <tr key={item.id}>
                    <td className="px-6 py-4 text-[#245C4F]">{String((page - 1) * PAGE_SIZE + index + 1).padStart(2, "0")}</td>
                    <td className="px-6 py-4 font-semibold text-[#063F32]">{item.student_name}</td>
                    <td className="px-6 py-4 text-[#245C4F]">{item.parent_name}</td>
                    <td className="px-6 py-4 text-[#245C4F]">{item.class_level}</td>
                    <td className="px-6 py-4 text-[#245C4F]">{item.email || "-"}</td>
                    <td className="px-6 py-4 text-[#245C4F]">{item.phone || "-"}</td>
                    <td className="px-6 py-4 text-[#245C4F]">{item.monthly_income ? formatMoney(item.monthly_income) : "-"}</td>
                    <td className="px-6 py-4 text-[#245C4F]">{item.dependents_count ?? "-"}</td>
                    <td className="px-6 py-4 text-[#245C4F]">{item.school_going_children_count ?? "-"}</td>
                    <td className="px-6 py-4 text-[#245C4F]">{item.residence_type || "-"}</td>
                    <td className="px-6 py-4 text-[#245C4F]">{item.guardian_employment_status || "-"}</td>
                    <td className="px-6 py-4 text-[#245C4F]">{formatMoney(item.requested_amount)}</td>
                    <td className="px-6 py-4 text-[#245C4F]">{formatMoney(item.scholarship_amount)}</td>
                    <td className="px-6 py-4 text-[#245C4F]">{item.voucher_created ? "Voucher Created" : "Submitted"}</td>
                    <td className="px-6 py-4 text-[#245C4F]">{formatDate(item.created_at)}</td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <button type="button" onClick={() => setSelectedItem(item)} className="rounded-xl border border-[#2D8A6A]/20 bg-[#FAF7F0] px-3 py-2 text-xs font-semibold text-[#063F32] transition hover:bg-[#F1EADC]">View details</button>
                        {!item.voucher_created ? (
                          <button
                            type="button"
                            onClick={() => setVoucherTarget(item)}
                            className="rounded-xl bg-[#0D5C48] px-3 py-2 text-xs font-semibold text-[#FAF7F0] transition hover:bg-[#063F32]"
                          >
                            Create voucher
                          </button>
                        ) : (
                          <span className="rounded-xl border border-[#2D8A6A]/20 bg-[#EAF6EF] px-3 py-2 text-xs font-semibold text-[#0D5C48] text-center">
                            Voucher created
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                )) : (
                  <tr>
                    <td className="px-6 py-8 text-center text-[#245C4F]" colSpan={8}>
                      {loading ? "Loading..." : "No scholarship records found."}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="px-6 py-5">
            <PaginationControls page={page} pageSize={PAGE_SIZE} totalItems={filteredItems.length} onPageChange={setPage} />
          </div>
        </section>

        {selectedItem ? (
          <ClientPortal targetId="coordinator-page-portal-root">
            <div className="absolute inset-x-0 top-0 z-[9999] isolate flex min-h-full items-start justify-center overflow-visible bg-[#063F32]/45 px-4 pb-10 pt-10">
              <div className="w-full max-w-3xl rounded-[2rem] border border-[#2D8A6A]/15 bg-[#FAF7F0] p-6 shadow-[0_24px_80px_-36px_rgba(13,59,46,0.24)] sm:p-8">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-sm font-semibold uppercase tracking-[0.24em] text-[#C9A227]">Need based scholarship</p>
                    <h2 className="mt-2 text-2xl font-semibold text-[#063F32]">{selectedItem.student_name}</h2>
                  </div>
                  <button type="button" onClick={() => setSelectedItem(null)} className="rounded-xl border border-[#2D8A6A]/20 bg-[#FAF7F0] px-3 py-2 text-sm font-semibold text-[#063F32] transition hover:bg-[#F1EADC]">Close</button>
                </div>
                <div className="mt-6 overflow-hidden rounded-2xl border border-[#2D8A6A]/15 bg-white">
                  <table className="w-full border-collapse text-sm text-[#245C4F]">
                    <tbody>
                      {[
                        ["Student", selectedItem.student_name || "-"],
                        ["Parent", selectedItem.parent_name || "-"],
                        ["Class", selectedItem.class_level || "-"],
                        ["Email", selectedItem.email || "-"],
                        ["Phone", selectedItem.phone || "-"],
                        ["Monthly income", formatMoney(selectedItem.monthly_income)],
                        ["Requested amount", formatMoney(selectedItem.requested_amount)],
                        ["Dependents", selectedItem.dependents_count ?? "-"],
                        ["School-going children", selectedItem.school_going_children_count ?? "-"],
                        ["Residence type", selectedItem.residence_type || "-"],
                        ["Employment status", selectedItem.guardian_employment_status || "-"],
                        ["Scholarship amount", formatMoney(selectedItem.scholarship_amount)],
                        ["Status", selectedItem.status || "-"],
                        ["Submitted at", formatDate(selectedItem.created_at)],
                        ["Reason", selectedItem.reason || "-"],
                      ].map(([label, value]) => (
                        <tr key={label} className="border-b border-[#F1EADC] last:border-b-0">
                          <td className="w-[38%] px-4 py-3 text-xs font-semibold uppercase tracking-[0.18em] text-[#0D5C48]">
                            {label}
                          </td>
                          <td className="px-4 py-3 text-[#245C4F]">{value}</td>
                        </tr>
                      ))}
                      <tr className="border-b border-[#F1EADC] last:border-b-0">
                        <td className="w-[38%] px-4 py-3 text-xs font-semibold uppercase tracking-[0.18em] text-[#0D5C48]">
                          Supporting document
                        </td>
                        <td className="px-4 py-3 text-[#245C4F]">
                          {selectedItem.supporting_document_preview_url || supportingDocumentPreviewUrl ? (
                            <a
                              href={selectedItem.supporting_document_preview_url || supportingDocumentPreviewUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="block"
                            >
                              <div className="relative h-44 w-full overflow-hidden rounded-xl border border-[#2D8A6A]/15 bg-[#FAF7F0]">
                                <Image
                                  src={selectedItem.supporting_document_preview_url || supportingDocumentPreviewUrl}
                                  alt="Supporting document preview"
                                  fill
                                  unoptimized
                                  className="object-cover transition hover:scale-[1.01]"
                                />
                              </div>
                            </a>
                          ) : (
                            "-"
                          )}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </ClientPortal>
        ) : null}

        {voucherTarget ? (
          <FeeVoucherForm
            leads={voucherLeads}
            initialLeadId={voucherTarget.registration_id}
            showTrigger={false}
            scholarshipAmount={voucherTarget.requested_amount}
            scholarshipFormId={voucherTarget.id}
            onCreated={async () => {
              setVoucherTarget(null);
              await load();
            }}
            onClose={() => setVoucherTarget(null)}
          />
        ) : null}
      </div>
    </div>
  );
}
