"use client";
import { useEffect, useMemo, useState } from "react";
import { ChevronDown } from "lucide-react";
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

function formatScholarshipStatus(item) {
  const status = String(item?.status || "").toLowerCase();
  const voucherStatus = String(item?.voucher_status || "").toLowerCase();
  const hasVoucher = Boolean(item?.voucher_id) || Boolean(item?.voucher_created);
  const hasFeeSubmission = Boolean(item?.has_fee_submission);

  if (status === "verified" || voucherStatus === "verified") return "Verified";
  if (status === "voucher_created") return "Voucher Created";
  if (status === "rejected") return "Rejected";
  if (hasFeeSubmission && (status === "pending" || status === "submitted")) return "Submitted";
  if (hasVoucher && status === "unpaid") return "Voucher Created";
  if (!hasVoucher) return "Pending";
  if (status === "pending") return "Voucher Created";
  if (status === "submitted") return "Pending";
  if (item?.voucher_created && !status) return "Voucher Created";
  return "Pending";
}

export function NeedBasedScholarshipsPage({
  portalLabel = "Coordinator portal",
  title = "Scholarship records",
  description = "Review scholarship applications, inspect the financial details, and create the follow-up voucher from one place.",
  allowCreateVoucher = true,
} = {}) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [columnFilter, setColumnFilter] = useState("all");
  const [verificationFilter, setVerificationFilter] = useState("verified");
  const [page, setPage] = useState(1);
  const [selectedItem, setSelectedItem] = useState(null);
  const [voucherTarget, setVoucherTarget] = useState(null);
  const [paymentApproveTarget, setPaymentApproveTarget] = useState(null);
  const [manualPaidAmount, setManualPaidAmount] = useState("");
  const [manualProofFile, setManualProofFile] = useState(null);
  const [manualApproving, setManualApproving] = useState(false);
  const [manualApproveError, setManualApproveError] = useState("");
  const [voucherUpdateTarget, setVoucherUpdateTarget] = useState(null);
  const [voucherUpdateForm, setVoucherUpdateForm] = useState({
    regularFeeAmount: "",
    admissionFeeAmount: "",
    discountAmount: "",
    scholarshipAmount: "",
    totalPayable: "",
    paidAmount: "",
  });
  const [voucherUpdating, setVoucherUpdating] = useState(false);
  const [voucherUpdateError, setVoucherUpdateError] = useState("");

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
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, []);

  function isVerifiedScholarship(item) {
    const leadStatus = String(item?.lead_status || "").toLowerCase();
    return Boolean(item?.is_lms_enrolled) || leadStatus === "access_granted" || leadStatus === "fee_verified";
  }

  const filteredItems = useMemo(() => {
    const term = String(search || "").trim().toLowerCase();
    const normalizedColumn = String(columnFilter || "all").trim().toLowerCase();
    const normalizedVerificationFilter = String(verificationFilter || "verified").trim().toLowerCase();

    return items.filter((item) => {
      const isVerified = isVerifiedScholarship(item);
      if (normalizedVerificationFilter === "verified" && !isVerified) return false;
      if (normalizedVerificationFilter === "not_verified" && isVerified) return false;

      const searchableMap = {
        all: [
          item.student_name,
          item.parent_name,
          item.class_level,
          item.email,
          item.phone,
          item.dependents_count,
          item.school_going_children_count,
          item.residence_type,
          item.requested_amount,
          item.scholarship_amount,
          formatScholarshipStatus(item),
          item.voucher_created ? "voucher created" : "submitted",
        ],
        student: item.student_name,
        parent: item.parent_name,
        class: item.class_level,
        email: item.email,
        phone: item.phone,
        dependents_count: item.dependents_count,
        school_going_children_count: item.school_going_children_count,
        residence_type: item.residence_type,
        requested: item.requested_amount,
        scholarship_amount: item.scholarship_amount,
        scholarship_reason: item.scholarship_reason,
        status: formatScholarshipStatus(item),
        submitted_at: item.created_at,
        voucher_created: item.voucher_created ? "voucher created" : "not created",
      };

      if (!term) return true;
      const searchableValue = searchableMap[normalizedColumn] ?? searchableMap.all;
      const searchText = Array.isArray(searchableValue) ? searchableValue.join(" | ") : String(searchableValue || "");
      return searchText.toLowerCase().includes(term);
    });
  }, [items, search, columnFilter, verificationFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredItems.length / PAGE_SIZE));
  const paginatedItems = filteredItems.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const verifiedCount = useMemo(() => items.filter((item) => isVerifiedScholarship(item)).length, [items]);
  const notVerifiedCount = Math.max(items.length - verifiedCount, 0);

  const columnOptions = [
    { label: "All columns", value: "all" },
    { label: "Student", value: "student" },
    { label: "Parent", value: "parent" },
    { label: "Class", value: "class" },
    { label: "Email", value: "email" },
    { label: "Phone", value: "phone" },
    { label: "Dependents", value: "dependents_count" },
    { label: "School Children", value: "school_going_children_count" },
    { label: "Residence Type", value: "residence_type" },
    { label: "Requested", value: "requested" },
    { label: "Scholarship Given Amount", value: "scholarship_amount" },
    { label: "Status", value: "status" },
    { label: "Submitted At", value: "submitted_at" },
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

  const canShowPaymentApprove = (item) => {
    const status = String(item?.status || "").toLowerCase();
    return Boolean(item?.voucher_id)
      && !Boolean(item?.has_fee_submission)
      && status !== "verified"
      && status !== "rejected";
  };

  const canShowVoucherUpdate = (item) => {
    return allowCreateVoucher && isVerifiedScholarship(item) && !item?.scholarship_form_voucher_id;
  };

  function openVoucherUpdate(item) {
    const regularFeeAmount = Number(item?.regular_fee_amount || 0);
    const admissionFeeAmount = Number(item?.admission_fee_amount || 0);
    const discountAmount = Number(item?.discount_amount || 0);
    const scholarshipAmount = Number(item?.voucher_scholarship_amount || item?.scholarship_amount || item?.requested_amount || 0);
    const totalPayable = Number(item?.voucher_total_amount || item?.voucher_amount || Math.max(regularFeeAmount + admissionFeeAmount - discountAmount - scholarshipAmount, 0));
    setVoucherUpdateTarget(item);
    setVoucherUpdateForm({
      regularFeeAmount: String(regularFeeAmount),
      admissionFeeAmount: String(admissionFeeAmount),
      discountAmount: String(discountAmount),
      scholarshipAmount: String(scholarshipAmount),
      totalPayable: String(totalPayable),
      paidAmount: String(Number(item?.paid_amount || item?.voucher_amount || totalPayable || 0)),
    });
    setVoucherUpdateError("");
  }

  function updateVoucherAmountField(name, value) {
    setVoucherUpdateForm((current) => {
      const next = { ...current, [name]: value };
      if (name !== "totalPayable") {
        const regularFeeAmount = Number(next.regularFeeAmount || 0);
        const admissionFeeAmount = Number(next.admissionFeeAmount || 0);
        const discountAmount = Number(next.discountAmount || 0);
        const scholarshipAmount = Number(next.scholarshipAmount || 0);
        next.totalPayable = String(Math.max(regularFeeAmount + admissionFeeAmount - discountAmount - scholarshipAmount, 0));
      }
      return next;
    });
  }

  async function updateScholarshipVoucher() {
    if (!voucherUpdateTarget?.id) return;

    setVoucherUpdating(true);
    setVoucherUpdateError("");

    try {
      const response = await fetch("/api/coordinator/need-based-scholarships/update-voucher", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scholarshipFormId: voucherUpdateTarget.id,
          ...voucherUpdateForm,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data?.message || "Unable to update scholarship voucher.");
      }

      setVoucherUpdateTarget(null);
      await load();
    } catch (error) {
      setVoucherUpdateError(error instanceof Error ? error.message : "Unable to update scholarship voucher.");
    } finally {
      setVoucherUpdating(false);
    }
  }

  async function approveScholarshipPayment() {
    if (!paymentApproveTarget?.id || !(manualProofFile instanceof File)) {
      setManualApproveError("Payment proof screenshot is required.");
      return;
    }

    setManualApproving(true);
    setManualApproveError("");

    try {
      const payload = new FormData();
      payload.append("scholarshipFormId", paymentApproveTarget.id);
      payload.append("paidAmount", String(Number(manualPaidAmount || paymentApproveTarget.voucher_amount || paymentApproveTarget.voucher_total_amount || 0)));
      payload.append("proofFile", manualProofFile);

      const response = await fetch("/api/coordinator/need-based-scholarships/manual-payment-approve", {
        method: "POST",
        body: payload,
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data?.message || "Unable to approve scholarship payment.");
      }

      setPaymentApproveTarget(null);
      setManualPaidAmount("");
      setManualProofFile(null);
      await load();
    } catch (error) {
      setManualApproveError(error instanceof Error ? error.message : "Unable to approve scholarship payment.");
    } finally {
      setManualApproving(false);
    }
  }

  const detailsPopupWrapperClassName = allowCreateVoucher
    ? "absolute inset-x-0 top-0 z-[9999] flex items-start justify-center px-4 pb-10 pt-10 sm:px-6 lg:-mx-10 lg:px-4"
    : "absolute inset-x-0 top-0 z-[9999] mx-auto flex min-h-full w-full max-w-7xl items-start justify-center px-4 pb-10 pt-10 sm:px-6 lg:px-8";

  return (
    <div className="min-h-screen bg-[#FAF7F0]">
      <div className="relative mx-auto max-w-7xl space-y-6 px-4 py-4 sm:px-6 lg:px-8">
        <section className="relative overflow-hidden rounded-[2rem] border border-[#2D8A6A]/15 bg-[linear-gradient(135deg,rgba(13,59,46,0.98),rgba(13,92,72,0.94))] p-6 text-[#FAF7F0] shadow-[0_24px_80px_-36px_rgba(13,59,46,0.32)] sm:p-8">
          <p className="inline-flex rounded-full border border-[#E4C766]/30 bg-[#FFF5D6]/12 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.28em] text-[#FFF5D6]">
            {portalLabel}
          </p>
          <h1 className="mt-4 font-display text-3xl font-bold tracking-tight sm:text-4xl">{title}</h1>
          <p className="mt-3 text-sm leading-7 text-[#EAF6EF] sm:text-base">{description}</p>
        </section>

        <section className="relative rounded-[2rem] border border-[#2D8A6A]/15 bg-[linear-gradient(180deg,rgba(255,255,255,0.96)_0%,rgba(250,247,240,0.98)_100%)] shadow-[0_20px_70px_-36px_rgba(13,59,46,0.18)]">
          <div className="flex flex-col gap-3 border-b border-[#2D8A6A]/12 px-6 py-5 lg:flex-row lg:items-center">
            <div className="relative w-full lg:w-80">
              <select
                value={verificationFilter}
                onChange={(event) => {
                  setVerificationFilter(event.target.value);
                  setPage(1);
                }}
                className="w-full appearance-none rounded-2xl border border-[#2D8A6A]/20 bg-white px-4 py-3 pr-10 text-sm font-semibold text-[#063F32] outline-none transition focus:border-[#2D8A6A] focus:ring-4 focus:ring-[#FFF5D6]"
              >
                <option value="verified">Verified students ({verifiedCount})</option>
                <option value="not_verified">Not verified students ({notVerifiedCount})</option>
              </select>
              <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#0D5C48]" />
            </div>
            <div className="relative w-full lg:w-96">
              <select
                value={columnFilter}
                onChange={(event) => {
                  setColumnFilter(event.target.value);
                  setPage(1);
                }}
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
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
              placeholder={`Search in ${columnOptions.find((option) => option.value === columnFilter)?.label || "selected column"}`}
              className="w-full rounded-2xl border border-[#2D8A6A]/20 bg-white px-4 py-3 text-sm text-[#063F32] outline-none transition focus:border-[#2D8A6A] focus:ring-4 focus:ring-[#FFF5D6]"
            />
            <div className="shrink-0 rounded-2xl px-4 py-3 text-sm font-semibold text-[#245C4F]">
              Showing {filteredItems.length} of {items.length}
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-[1500px] text-left text-sm">
              <thead className="bg-[linear-gradient(180deg,#FAF7F0_0%,#F1EADC_100%)] text-xs uppercase tracking-[0.18em] text-[#0D5C48]">
                <tr>
                  <th className="min-w-12 px-6 py-4">#</th>
                  <th className="min-w-44 px-6 py-4">Student</th>
                  <th className="min-w-44 px-6 py-4">Parent</th>
                  <th className="min-w-36 px-6 py-4">Class</th>
                  <th className="min-w-44 px-6 py-4">Requested Amount</th>
                  <th className="min-w-52 px-6 py-4">Scholarship Given Amount</th>
                  <th className="min-w-32 px-6 py-4">Dependents</th>
                  <th className="min-w-40 px-6 py-4">School Children</th>
                  <th className="min-w-36 px-6 py-4">Residence</th>
                  <th className="min-w-36 px-6 py-4">Status</th>
                  <th className="min-w-48 px-6 py-4">Submitted At</th>
                  <th className="min-w-56 px-6 py-4">Email</th>
                  <th className="min-w-40 px-6 py-4">Phone</th>
                  <th className="min-w-52 px-6 py-4">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F1EADC]">
                {paginatedItems.length ? paginatedItems.map((item, index) => (
                  <tr key={item.id}>
                    <td className="px-6 py-4 text-[#245C4F]">{String((page - 1) * PAGE_SIZE + index + 1).padStart(2, "0")}</td>
                    <td className="px-6 py-4 font-semibold text-[#063F32]">{item.student_name}</td>
                    <td className="px-6 py-4 text-[#245C4F]">{item.parent_name}</td>
                    <td className="px-6 py-4 text-[#245C4F]">{item.class_level}</td>
                    <td className="px-6 py-4 text-[#245C4F]">{formatMoney(item.requested_amount)}</td>
                    <td className="px-6 py-4 text-[#245C4F]">{formatMoney(item.scholarship_amount)}</td>
                    <td className="px-6 py-4 text-[#245C4F]">{item.dependents_count ?? "-"}</td>
                    <td className="px-6 py-4 text-[#245C4F]">{item.school_going_children_count ?? "-"}</td>
                    <td className="px-6 py-4 text-[#245C4F]">{item.residence_type || "-"}</td>
                    <td className="px-6 py-4 text-[#245C4F]">{formatScholarshipStatus(item)}</td>
                    <td className="px-6 py-4 text-[#245C4F]">{formatDate(item.created_at)}</td>
                    <td className="px-6 py-4 text-[#245C4F]">{item.email || "-"}</td>
                    <td className="px-6 py-4 text-[#245C4F]">{item.phone || "-"}</td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <button type="button" onClick={() => setSelectedItem(item)} className="rounded-xl border border-[#2D8A6A]/20 bg-[#FAF7F0] px-3 py-2 text-xs font-semibold text-[#063F32] transition hover:bg-[#F1EADC]">View details</button>
                        {allowCreateVoucher ? (
                          canShowVoucherUpdate(item) ? (
                            <button
                              type="button"
                              onClick={() => openVoucherUpdate(item)}
                              className="rounded-xl bg-[#C9A227] px-3 py-2 text-xs font-semibold text-[#063F32] transition hover:bg-[#E4C766]"
                            >
                              Update Voucher
                            </button>
                          ) : item.voucher_created ? (
                            canShowPaymentApprove(item) ? (
                              <button
                                type="button"
                                onClick={() => {
                                  setPaymentApproveTarget(item);
                                  setManualPaidAmount(String(Number(item.voucher_amount || item.voucher_total_amount || 0)));
                                  setManualProofFile(null);
                                  setManualApproveError("");
                                }}
                                className="rounded-xl bg-[#0D5C48] px-3 py-2 text-xs font-semibold text-[#FAF7F0] transition hover:bg-[#063F32]"
                              >
                                Payment approve
                              </button>
                            ) : (
                              <span className="rounded-xl border border-[#2D8A6A]/20 bg-[#EAF6EF] px-3 py-2 text-xs font-semibold text-[#0D5C48] text-center">
                                Voucher created
                              </span>
                            )
                          ) : (
                            <button
                              type="button"
                              onClick={() => setVoucherTarget(item)}
                              className="rounded-xl bg-[#0D5C48] px-3 py-2 text-xs font-semibold text-[#FAF7F0] transition hover:bg-[#063F32]"
                            >
                              Create voucher
                            </button>
                          )
                        ) : null}
                      </div>
                    </td>
                  </tr>
                )) : (
                  <tr>
                    <td className="px-6 py-8 text-center text-[#245C4F]" colSpan={14}>
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
          <div className={`${detailsPopupWrapperClassName} min-h-full`}>
            <div className="absolute inset-0 -bottom-24 bg-[#063F32]/45 backdrop-blur-sm" />
            <div className="relative max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-[2rem] border border-[#2D8A6A]/15 bg-[#FAF7F0] p-6 shadow-[0_24px_80px_-36px_rgba(13,59,46,0.24)] sm:p-8">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold uppercase tracking-[0.24em] text-[#C9A227]">Scholarship</p>
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
                      ["Requested amount", formatMoney(selectedItem.requested_amount)],
                      ["Dependents", selectedItem.dependents_count ?? "-"],
                      ["School-going children", selectedItem.school_going_children_count ?? "-"],
                      ["Residence type", selectedItem.residence_type || "-"],
                      ["Scholarship amount", formatMoney(selectedItem.scholarship_amount)],
                      ["Scholarship reason", selectedItem.scholarship_reason || "-"],
                      ["Status", formatScholarshipStatus(selectedItem)],
                      ["Submitted at", formatDate(selectedItem.created_at)],
                    ].map(([label, value]) => (
                      <tr key={label} className="border-b border-[#F1EADC] last:border-b-0">
                        <td className="w-[38%] px-4 py-3 text-xs font-semibold uppercase tracking-[0.18em] text-[#0D5C48]">
                          {label}
                        </td>
                        <td className="px-4 py-3 text-[#245C4F]">{value}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        ) : null}

        {allowCreateVoucher && voucherTarget ? (
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

        {paymentApproveTarget ? (
          <div className="fixed inset-0 z-[9999] flex items-start justify-center overflow-hidden bg-[#063F32]/45 px-4 py-8 pt-24 backdrop-blur-sm sm:px-6">
            <div className="relative flex max-h-[calc(100vh-7rem)] w-full max-w-3xl flex-col overflow-hidden rounded-[2rem] border border-[#2D8A6A]/15 bg-[#FAF7F0] shadow-[0_24px_80px_-36px_rgba(13,59,46,0.24)]">
              <div className="flex items-start justify-between gap-4 border-b border-[#2D8A6A]/12 px-6 py-5">
                <div>
                  <p className="text-sm font-semibold uppercase tracking-[0.24em] text-[#C9A227]">Scholarship payment</p>
                  <h2 className="mt-2 text-2xl font-semibold text-[#063F32]">{paymentApproveTarget.student_name}</h2>
                </div>
                <button
                  type="button"
                  onClick={() => setPaymentApproveTarget(null)}
                  className="rounded-xl border border-[#2D8A6A]/20 bg-[#FAF7F0] px-3 py-2 text-sm font-semibold text-[#063F32] transition hover:bg-[#F1EADC]"
                >
                  Close
                </button>
              </div>

              <div className="flex-1 space-y-5 overflow-y-auto p-6">
                <div className="overflow-hidden rounded-2xl border border-[#2D8A6A]/15 bg-white">
                  <table className="w-full border-collapse text-sm text-[#245C4F]">
                    <tbody>
                      {[
                        ["Voucher no", paymentApproveTarget.voucher_no || "-"],
                        ["Requested amount", formatMoney(paymentApproveTarget.requested_amount)],
                        ["Voucher amount", formatMoney(paymentApproveTarget.voucher_amount || paymentApproveTarget.voucher_total_amount)],
                        ["Regular fee", formatMoney(paymentApproveTarget.regular_fee_amount)],
                        ["Admission fee", formatMoney(paymentApproveTarget.admission_fee_amount)],
                        ["Discount", formatMoney(paymentApproveTarget.discount_amount)],
                        ["Scholarship", formatMoney(paymentApproveTarget.voucher_scholarship_amount || paymentApproveTarget.scholarship_amount)],
                        ["Due date", formatDate(paymentApproveTarget.due_date)],
                      ].map(([label, value]) => (
                        <tr key={label} className="border-b border-[#F1EADC] last:border-b-0">
                          <td className="w-[38%] px-4 py-3 text-xs font-semibold uppercase tracking-[0.18em] text-[#0D5C48]">{label}</td>
                          <td className="px-4 py-3 text-[#245C4F]">{value}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-[#063F32]">Paid amount</span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={manualPaidAmount}
                    onChange={(event) => setManualPaidAmount(event.target.value)}
                    className="w-full rounded-2xl border border-[#2D8A6A]/20 bg-white px-4 py-3 text-sm text-[#063F32] outline-none transition focus:border-[#2D8A6A] focus:ring-4 focus:ring-[#FFF5D6]"
                  />
                </label>

                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-[#063F32]">Upload proof</span>
                  <input
                    type="file"
                    accept="image/*,.pdf"
                    onChange={(event) => setManualProofFile(event.target.files?.[0] || null)}
                    className="block w-full rounded-2xl border border-[#2D8A6A]/20 bg-white px-4 py-3 text-sm text-[#063F32] file:mr-4 file:rounded-xl file:border-0 file:bg-[#0D5C48] file:px-4 file:py-2 file:text-sm file:font-semibold file:text-[#FAF7F0] focus:border-[#2D8A6A] focus:ring-4 focus:ring-[#FFF5D6]"
                  />
                </label>

                {manualApproveError ? (
                  <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                    {manualApproveError}
                  </div>
                ) : null}
              </div>

              <div className="flex items-center justify-end gap-3 border-t border-[#2D8A6A]/12 px-6 py-5">
                <button
                  type="button"
                  onClick={() => setPaymentApproveTarget(null)}
                  className="rounded-xl border border-[#2D8A6A]/20 bg-[#FAF7F0] px-4 py-2 text-sm font-semibold text-[#063F32] transition hover:bg-[#F1EADC]"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => void approveScholarshipPayment()}
                  disabled={manualApproving}
                  className="rounded-xl bg-[#0D5C48] px-4 py-2 text-sm font-semibold text-[#FAF7F0] transition hover:bg-[#063F32] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {manualApproving ? "Approving..." : "Approve payment"}
                </button>
              </div>
            </div>
          </div>
        ) : null}

        {voucherUpdateTarget ? (
          <div className="fixed inset-0 z-[9999] flex items-start justify-center overflow-hidden bg-[#063F32]/45 px-4 py-8 pt-24 backdrop-blur-sm sm:px-6">
            <div className="relative flex max-h-[calc(100vh-7rem)] w-full max-w-3xl flex-col overflow-hidden rounded-[2rem] border border-[#2D8A6A]/15 bg-[#FAF7F0] shadow-[0_24px_80px_-36px_rgba(13,59,46,0.24)]">
              <div className="flex items-start justify-between gap-4 border-b border-[#2D8A6A]/12 px-6 py-5">
                <div>
                  <p className="text-sm font-semibold uppercase tracking-[0.24em] text-[#C9A227]">Scholarship voucher recovery</p>
                  <h2 className="mt-2 text-2xl font-semibold text-[#063F32]">Update Voucher</h2>
                  <p className="mt-1 text-sm text-[#245C4F]">
                    Link this scholarship form to the existing admission voucher without sending email or credentials.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setVoucherUpdateTarget(null)}
                  className="rounded-xl border border-[#2D8A6A]/20 bg-[#FAF7F0] px-3 py-2 text-sm font-semibold text-[#063F32] transition hover:bg-[#F1EADC]"
                >
                  Close
                </button>
              </div>

              <div className="flex-1 space-y-5 overflow-y-auto p-6">
                <div className="overflow-hidden rounded-2xl border border-[#2D8A6A]/15 bg-white">
                  <table className="w-full border-collapse text-sm text-[#245C4F]">
                    <tbody>
                      {[
                        ["Student", voucherUpdateTarget.student_name || "-"],
                        ["Parent", voucherUpdateTarget.parent_name || "-"],
                        ["Class", voucherUpdateTarget.class_level || "-"],
                        ["Voucher no", voucherUpdateTarget.voucher_no || "Existing admission voucher"],
                        ["Scholarship requested", formatMoney(voucherUpdateTarget.requested_amount)],
                      ].map(([label, value]) => (
                        <tr key={label} className="border-b border-[#F1EADC] last:border-b-0">
                          <td className="w-[38%] px-4 py-3 text-xs font-semibold uppercase tracking-[0.18em] text-[#0D5C48]">{label}</td>
                          <td className="px-4 py-3 text-[#245C4F]">{value}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  {[
                    ["regularFeeAmount", "Monthly fee"],
                    ["admissionFeeAmount", "Admission fee"],
                    ["discountAmount", "Discount"],
                    ["scholarshipAmount", "Scholarship given"],
                    ["totalPayable", "Total payable"],
                    ["paidAmount", "Paid amount"],
                  ].map(([name, label]) => (
                    <label key={name} className="block">
                      <span className="mb-2 block text-sm font-medium text-[#063F32]">{label}</span>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={voucherUpdateForm[name]}
                        onChange={(event) => updateVoucherAmountField(name, event.target.value)}
                        className="w-full rounded-2xl border border-[#2D8A6A]/20 bg-white px-4 py-3 text-sm text-[#063F32] outline-none transition focus:border-[#2D8A6A] focus:ring-4 focus:ring-[#FFF5D6]"
                      />
                    </label>
                  ))}
                </div>

                {voucherUpdateError ? (
                  <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                    {voucherUpdateError}
                  </div>
                ) : null}
              </div>

              <div className="flex items-center justify-end gap-3 border-t border-[#2D8A6A]/12 px-6 py-5">
                <button
                  type="button"
                  onClick={() => setVoucherUpdateTarget(null)}
                  className="rounded-xl border border-[#2D8A6A]/20 bg-[#FAF7F0] px-4 py-2 text-sm font-semibold text-[#063F32] transition hover:bg-[#F1EADC]"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => void updateScholarshipVoucher()}
                  disabled={voucherUpdating}
                  className="rounded-xl bg-[#0D5C48] px-4 py-2 text-sm font-semibold text-[#FAF7F0] transition hover:bg-[#063F32] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {voucherUpdating ? "Updating..." : "Update Voucher"}
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

export default function CoordinatorNeedBasedScholarshipsPage() {
  return <NeedBasedScholarshipsPage />;
}
