"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronDown, Search } from "lucide-react";
import { jsPDF } from "jspdf";
import ClientPortal from "@/components/shared/ClientPortal";
import PaginationControls from "@/components/teacher/PaginationControls";
import { applyCarryForwardHistoryRows, computeFeeHistoryAmounts } from "@/lib/feeHistory";

const PAGE_SIZE = 7;

function formatMoney(value) {
  return `PKR ${Number(value || 0).toLocaleString("en-PK")}`;
}

function formatDate(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat("en-PK", { dateStyle: "medium" }).format(date);
}

function normalizeText(value) {
  return String(value || "").trim().toLowerCase();
}

function moneyInputValue(value) {
  const amount = Number(value || 0);
  return Number.isFinite(amount) ? String(amount) : "0";
}

function computeAmounts(previousMonthDue, currentMonthFee, thisMonthPaid) {
  const previous = Number(previousMonthDue || 0);
  const current = Number(currentMonthFee || 0);
  const paid = Number(thisMonthPaid || 0);
  const total = previous + current;
  const remaining = Math.max(0, total - paid);
  return { total, remaining };
}

function buildCarryForwardHistoryRows(historyItems, drafts = {}) {
  const rows = applyCarryForwardHistoryRows(historyItems);

  return rows.map((row) => {
    const draft = drafts[row.id] || {};
    const currentMonthFee = Number(draft.current_month_fee ?? row.current_month_fee ?? 0);
    const thisMonthPaid = Number(draft.this_month_paid ?? row.this_month_paid ?? 0);
    const previousMonthDue = Number(row.computedPreviousMonthDue ?? row.previous_month_due ?? 0);
    const computed = computeFeeHistoryAmounts({ previousMonthDue, currentMonthFee, thisMonthPaid });

    return {
      ...row,
      computedPreviousMonthDue: previousMonthDue,
      computedCurrentMonthFee: computed.currentMonthFee,
      computedThisMonthPaid: computed.thisMonthPaid,
      computedTotalAmount: computed.totalAmount,
      computedRemainingDue: computed.remainingDue,
    };
  });
}

function getCurrentMonthFeeParts(row) {
  const regularFee = Number(row?.regular_fee_amount || 0);
  const admissionFee = Number(row?.admission_fee_amount || 0);
  const discount = Number(row?.discount_amount || 0);
  const scholarshipAmount = Number(row?.scholarship_amount || 0);
  const hasBreakdown = regularFee > 0 || admissionFee > 0 || discount > 0 || scholarshipAmount > 0;
  const derivedTotal = regularFee + admissionFee - discount - scholarshipAmount;
  const currentMonthFee = hasBreakdown
    ? derivedTotal
    : Number(row?.current_month_fee || row?.total_amount || derivedTotal);

  return {
    regularFee,
    admissionFee,
    discount,
    scholarshipAmount,
    currentMonthFee,
  };
}

export default function CoordinatorFeeHistoryPage() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [page, setPage] = useState(1);
  const [classFilter, setClassFilter] = useState("all");
  const [columnFilter, setColumnFilter] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [classOpen, setClassOpen] = useState(false);
  const [columnOpen, setColumnOpen] = useState(false);

  const [selectedStudent, setSelectedStudent] = useState(null);
  const [historyItems, setHistoryItems] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState("");
  const [historyMessage, setHistoryMessage] = useState("");
  const [historyPage, setHistoryPage] = useState(1);
  const [historyColumnFilter, setHistoryColumnFilter] = useState("all");
  const [historySearchTerm, setHistorySearchTerm] = useState("");
  const [historyStatusFilter, setHistoryStatusFilter] = useState("all");
  const [historyColumnOpen, setHistoryColumnOpen] = useState(false);
  const [historyStatusOpen, setHistoryStatusOpen] = useState(false);
  const [drafts, setDrafts] = useState({});
  const [savingRowId, setSavingRowId] = useState("");
  const [voucherPdfLoadingId, setVoucherPdfLoadingId] = useState("");

  async function loadSummaries() {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/coordinator/fee-history", { cache: "no-store" });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data?.message || "Unable to load fee history.");
      setItems(Array.isArray(data.items) ? data.items : []);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load fee history.");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }

  async function openStudentHistory(item) {
    if (!item?.student_id) return;
    setSelectedStudent(item);
    setHistoryLoading(true);
    setHistoryError("");
    setHistoryMessage("");
    setHistoryItems([]);
    setDrafts({});
    setHistoryPage(1);
    setHistoryColumnFilter("all");
    setHistorySearchTerm("");
    setHistoryStatusFilter("all");
    try {
      const response = await fetch(`/api/coordinator/fee-history?studentId=${encodeURIComponent(item.student_id)}`, { cache: "no-store" });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data?.message || "Unable to load student fee history.");
      const nextItems = Array.isArray(data.items) ? data.items : [];
      const carryForwardRows = buildCarryForwardHistoryRows(nextItems);
      setHistoryItems(nextItems);
      setDrafts(Object.fromEntries(carryForwardRows.map((row) => [row.id, {
        previous_month_due: moneyInputValue(row.computedPreviousMonthDue ?? row.previous_month_due),
        discount_amount: moneyInputValue(row.discount_amount),
        current_month_fee: moneyInputValue(row.current_month_fee),
        this_month_paid: moneyInputValue(row.this_month_paid),
      }])));
    } catch (loadError) {
      setHistoryError(loadError instanceof Error ? loadError.message : "Unable to load student fee history.");
      setHistoryItems([]);
      setDrafts({});
    } finally {
      setHistoryLoading(false);
    }
  }

  async function saveHistoryRow(row) {
    if (!row?.id) return;
    const draft = drafts[row.id] || {};
    setSavingRowId(row.id);
    setHistoryMessage("");
    setHistoryError("");
    try {
      const response = await fetch("/api/coordinator/fee-history", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rowId: row.id,
          sourceType: row.source_type,
          studentId: row.student_id,
          batchId: row.batch_id,
          voucherId: row.voucher_id,
          registrationId: row.registration_id,
          monthLabel: row.month_label,
          dueDate: row.due_date,
          previousMonthDue: draft.previous_month_due,
          discountAmount: draft.discount_amount,
          currentMonthFee: draft.current_month_fee,
          thisMonthPaid: draft.this_month_paid,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data?.message || "Unable to update fee history row.");
      if (selectedStudent?.student_id) {
        await openStudentHistory(selectedStudent);
      }
      setHistoryMessage(data?.message || "Fee history updated.");
      window.setTimeout(() => setHistoryMessage(""), 3000);
      await loadSummaries();
    } catch (saveError) {
      setHistoryError(saveError instanceof Error ? saveError.message : "Unable to update fee history row.");
    } finally {
      setSavingRowId("");
    }
  }


  async function downloadVoucherPdf(row) {
    if (!row?.voucher_id) return;
    setVoucherPdfLoadingId(row.id);
    setHistoryError("");
    try {
      const response = await fetch("/api/coordinator/fee-vouchers/" + encodeURIComponent(row.voucher_id), { cache: "no-store" });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data?.message || "Unable to load voucher details.");
      const voucher = data?.item || {};
      const parts = getCurrentMonthFeeParts(row);
      const previousMonthDueValue = Number(row.computedPreviousMonthDue ?? row.previous_month_due ?? 0);
      const computedTotalAmount = previousMonthDueValue + parts.currentMonthFee;
      const paymentSummary = computeAmounts(previousMonthDueValue, parts.currentMonthFee, row.this_month_paid);
      const doc = new jsPDF({ unit: "pt", format: "a4" });
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const margin = 40;
      const contentWidth = pageWidth - margin * 2;
      let y = margin;
      const safeText = (value) => String(value || "-");
      const lines = [
        ["Voucher No", safeText(voucher.voucher_no || row.voucher_no)],
        ["Student", safeText(voucher.student_name || selectedStudent?.student_name || "-")],
        ["Parent", safeText(voucher.parent_name || selectedStudent?.parent_name || "-")],
        ["Class", safeText(voucher.class_level || selectedStudent?.class_level || "-")],
        ["Due Date", formatDate(voucher.due_date || row.due_date)],
        ["Monthly Fee", formatMoney(parts.regularFee)],
        ["Admission Fee", formatMoney(parts.admissionFee)],
        ["Discount", formatMoney(parts.discount)],
        ["Scholarship", formatMoney(parts.scholarshipAmount)],
        ["Current Month Fee", formatMoney(parts.currentMonthFee)],
        ["This Month Paid", formatMoney(row.this_month_paid)],
        ["Remaining Due", formatMoney(computeAmounts(row.previous_month_due, parts.currentMonthFee, row.this_month_paid).remaining)],
      ];
      const theme = {
        background: [250, 247, 240],
        surface: [255, 255, 255],
        border: [45, 138, 106],
        primary: [13, 92, 72],
        text: [6, 63, 50],
        muted: [36, 92, 79],
        accent: [201, 162, 39],
      };

      const drawRoundedCard = (x, yPos, width, height) => {
        doc.setDrawColor(...theme.border);
        doc.setFillColor(...theme.surface);
        doc.roundedRect(x, yPos, width, height, 12, 12, "FD");
      };

      const SECTION_BOTTOM_PADDING = 16; // space below the last label row

      const addSection = (title, items, startY, rowGap = 18) => {
        // header (28) + top padding before first row (14) + rows + bottom padding
        const boxHeight = Math.max(
          84,
          28 + 14 + items.length * rowGap + SECTION_BOTTOM_PADDING
        );
        drawRoundedCard(margin, startY, contentWidth, boxHeight);
        doc.setFillColor(...theme.primary);
        doc.roundedRect(margin, startY, contentWidth, 28, 10, 10, "F");
        doc.setFont("helvetica", "bold");
        doc.setFontSize(11);
        doc.setTextColor(250, 247, 240);
        doc.text(title, margin + 16, startY + 18);

        doc.setTextColor(...theme.text);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(10.5);
        const bodyY = startY + 42;
        items.forEach(([label, value], index) => {
          const labelText = `${label}:`;
          const valueText = String(value || "-");
          const labelWidth = doc.getTextWidth(labelText);
          const safeMaxWidth = contentWidth - labelWidth - 24;
          const wrappedValue = doc.splitTextToSize(valueText, safeMaxWidth);
          const rowY = bodyY + index * rowGap;
          doc.text(labelText, margin + 16, rowY);
          doc.text(wrappedValue[0], margin + 16 + labelWidth + 10, rowY);
          if (wrappedValue.length > 1) {
            wrappedValue.slice(1).forEach((line, lineIndex) => {
              doc.text(line, margin + 16 + labelWidth + 10, rowY + 12 + lineIndex * 10);
            });
          }
        });

        return boxHeight; // return so the caller can space the next section correctly
      };

      doc.setFillColor(...theme.background);
      doc.rect(0, 0, pageWidth, pageHeight, "F");

      doc.setFillColor(...theme.primary);
      doc.roundedRect(margin, margin, contentWidth, 112, 16, 16, "F");
      doc.setDrawColor(...theme.accent);
      doc.setLineWidth(1.2);
      doc.line(margin + 16, margin + 72, margin + contentWidth - 16, margin + 72);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(20);
      doc.setTextColor(250, 247, 240);
      doc.text("Ash-Shajrah Learning Hub (ALH)", margin + 18, margin + 32);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(11);
      doc.setTextColor(255, 245, 214);
      doc.text("Fee Voucher", margin + 18, margin + 54);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(12);
      doc.setTextColor(250, 247, 240);
      doc.text(String(voucher.voucher_no || row.voucher_no || "Voucher"), margin + 18, margin + 98);

      y = margin + 146;
      const summaryItems = [
        ["Student", safeText(voucher.student_name || selectedStudent?.student_name || "-")],
        ["Parent", safeText(voucher.parent_name || selectedStudent?.parent_name || "-")],
        ["Class", safeText(voucher.class_level || selectedStudent?.class_level || "-")],
        ["Due Date", formatDate(voucher.due_date || row.due_date)],
      ];
      const summarySectionHeight = addSection("Voucher details", summaryItems, y);

      y += summarySectionHeight + 24;
      const feeItems = [
        ["Monthly Fee", formatMoney(parts.regularFee)],
        ["Admission Fee", formatMoney(parts.admissionFee)],
        ["Discount", formatMoney(parts.discount)],
        ["Scholarship", formatMoney(parts.scholarshipAmount)],
        ["Previous Month Due", formatMoney(previousMonthDueValue)],
        ["Current Month Fee", formatMoney(parts.currentMonthFee)],
        ["Total Amount", formatMoney(computedTotalAmount)],
      ];
      const feeSectionHeight = addSection("Fee breakdown", feeItems, y, 20);

      y += feeSectionHeight + 24;
      const balanceItems = [
        ["This Month Paid", formatMoney(row.this_month_paid)],
        ["Remaining Due", formatMoney(paymentSummary.remaining)],
      ];
      addSection("Payment summary", balanceItems, y, 22);

      const fileName = `${String(voucher.voucher_no || row.voucher_no || "voucher").replace(/[^\w.-]+/g, "_")}.pdf`;
      const blob = doc.output("blob");
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = fileName;
      anchor.target = "_blank";
      anchor.rel = "noreferrer";
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.open(url, "_blank", "noopener,noreferrer");
      window.setTimeout(() => URL.revokeObjectURL(url), 10000);
      setHistoryMessage("Voucher PDF downloaded.");
      window.setTimeout(() => setHistoryMessage(""), 3000);
    } catch (downloadError) {
      setHistoryError(downloadError instanceof Error ? downloadError.message : "Unable to download voucher PDF.");
    } finally {
      setVoucherPdfLoadingId("");
    }
  }

  useEffect(() => {
    void loadSummaries();
  }, []);

  useEffect(() => {
    setPage(1);
  }, [classFilter, columnFilter, searchTerm]);

  useEffect(() => {
    setHistoryPage(1);
  }, [historyColumnFilter, historySearchTerm, historyStatusFilter]);

  const classOptions = useMemo(() => {
    return Array.from(new Set(items.map((item) => String(item.class_level || "").trim()).filter(Boolean))).sort((a, b) => a.localeCompare(b));
  }, [items]);

  const filteredItems = useMemo(() => {
    const query = normalizeText(searchTerm);
    return items.filter((item) => {
      if (classFilter !== "all" && String(item.class_level || "") !== classFilter) return false;
      if (!query) return true;
      const fields = columnFilter === "all"
        ? [item.student_name, item.parent_name, item.class_level, item.admission_no, item.student_email, item.parent_email, item.current_pending_dues, item.latest_month_label]
        : [item[columnFilter]];
      return fields.some((value) => normalizeText(value).includes(query));
    });
  }, [items, classFilter, columnFilter, searchTerm]);

  const totalPages = Math.max(1, Math.ceil(filteredItems.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const visibleItems = useMemo(() => {
    const startIndex = (safePage - 1) * PAGE_SIZE;
    return filteredItems.slice(startIndex, startIndex + PAGE_SIZE);
  }, [filteredItems, safePage]);

  const carryForwardHistoryRows = useMemo(() => buildCarryForwardHistoryRows(historyItems, drafts), [historyItems, drafts]);

  const filteredHistoryItems = useMemo(() => {
    const query = normalizeText(historySearchTerm);
    return carryForwardHistoryRows.filter((item) => {
      if (historyStatusFilter !== "all" && normalizeText(item.payment_status) !== historyStatusFilter) return false;
      if (!query) return true;
      const fields = historyColumnFilter === "all"
        ? [item.month_label, item.voucher_no, item.payment_status, item.due_date]
        : [item[historyColumnFilter]];
      return fields.some((value) => normalizeText(value).includes(query));
    });
  }, [carryForwardHistoryRows, historyColumnFilter, historySearchTerm, historyStatusFilter]);

  const historyTotalPages = Math.max(1, Math.ceil(filteredHistoryItems.length / PAGE_SIZE));
  const safeHistoryPage = Math.min(historyPage, historyTotalPages);
  const visibleHistoryItems = useMemo(() => {
    const startIndex = (safeHistoryPage - 1) * PAGE_SIZE;
    return filteredHistoryItems.slice(startIndex, startIndex + PAGE_SIZE);
  }, [filteredHistoryItems, safeHistoryPage]);

  return (
    <div className="min-h-screen bg-[#FAF7F0]">
      <div className="relative mx-auto max-w-7xl space-y-6 px-4 py-4 sm:px-6 lg:px-8">
        <section className="relative overflow-hidden rounded-[2rem] border border-[#2D8A6A]/15 bg-[linear-gradient(135deg,rgba(13,59,46,0.98),rgba(13,92,72,0.94))] p-6 text-[#FAF7F0] shadow-[0_24px_80px_-36px_rgba(13,59,46,0.32)] sm:p-8">
          <p className="inline-flex rounded-full border border-[#E4C766]/30 bg-[#FFF5D6]/12 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.28em] text-[#FFF5D6]">
            Coordinator portal
          </p>
          <h1 className="mt-4 font-display text-3xl font-bold tracking-tight text-[#FAF7F0] sm:text-4xl">Fee History</h1>
          <p className="mt-3 text-sm leading-7 text-[#EAF6EF] sm:text-base">
            Review verified student fee records, track pending dues, and maintain the month-by-month fee cycle in one place.
          </p>
        </section>

        {error ? <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{error}</div> : null}
        {message ? <div className="rounded-2xl border border-[#2D8A6A]/15 bg-[#EAF6EF] p-4 text-sm text-[#0D5C48]">{message}</div> : null}

        <section className="rounded-[2rem] border border-[#2D8A6A]/15 bg-[linear-gradient(180deg,rgba(255,255,255,0.96)_0%,rgba(250,247,240,0.98)_100%)] shadow-[0_20px_70px_-36px_rgba(13,59,46,0.18)] backdrop-blur-xl">
          <div className="grid gap-4 border-b border-[#2D8A6A]/10 px-6 py-5 lg:grid-cols-[220px_220px_minmax(0,1fr)]">
            <div className="relative">
              <p className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-[#0D5C48]">Class</p>
              <select
                value={classFilter}
                onFocus={() => setClassOpen(true)}
                onBlur={() => setClassOpen(false)}
                onChange={(event) => setClassFilter(event.target.value)}
                className="w-full appearance-none rounded-2xl border border-[#2D8A6A]/20 bg-white px-4 py-3 pr-11 text-sm text-[#063F32] outline-none focus:border-[#2D8A6A]"
              >
                <option value="all">All classes</option>
                {classOptions.map((item) => <option key={item} value={item}>{item}</option>)}
              </select>
              <ChevronDown className={`pointer-events-none absolute right-4 top-[calc(50%+14px)] h-4 w-4 -translate-y-1/2 text-[#0D5C48] transition-transform ${classOpen ? "rotate-180" : ""}`} />
            </div>
            <div className="relative">
              <p className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-[#0D5C48]">Search column</p>
              <select
                value={columnFilter}
                onFocus={() => setColumnOpen(true)}
                onBlur={() => setColumnOpen(false)}
                onChange={(event) => setColumnFilter(event.target.value)}
                className="w-full appearance-none rounded-2xl border border-[#2D8A6A]/20 bg-white px-4 py-3 pr-11 text-sm text-[#063F32] outline-none focus:border-[#2D8A6A]"
              >
                <option value="all">All columns</option>
                <option value="student_name">Student</option>
                <option value="parent_name">Parent</option>
                <option value="class_level">Class</option>
                <option value="admission_no">Admission No</option>
                <option value="latest_month_label">Latest month</option>
              </select>
              <ChevronDown className={`pointer-events-none absolute right-4 top-[calc(50%+14px)] h-4 w-4 -translate-y-1/2 text-[#0D5C48] transition-transform ${columnOpen ? "rotate-180" : ""}`} />
            </div>
            <div className="relative">
              <p className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-[#0D5C48]">Search</p>
              <Search className="pointer-events-none absolute left-4 top-[calc(50%+14px)] h-4 w-4 -translate-y-1/2 text-[#0D5C48]" />
              <input
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Search fee history records"
                className="w-full rounded-2xl border border-[#2D8A6A]/20 bg-white py-3 pl-11 pr-4 text-sm text-[#063F32] outline-none focus:border-[#2D8A6A]"
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-[linear-gradient(180deg,#FAF7F0_0%,#F1EADC_100%)] text-xs uppercase tracking-[0.18em] text-[#0D5C48]">
                <tr>
                  <th className="whitespace-nowrap px-6 py-4">#</th>
                  <th className="whitespace-nowrap px-6 py-4">Student</th>
                  <th className="whitespace-nowrap px-6 py-4">Parent</th>
                  <th className="whitespace-nowrap px-6 py-4">Email Address</th>
                  <th className="whitespace-nowrap px-6 py-4">Class</th>
                  <th className="whitespace-nowrap px-6 py-4">Admission No</th>
                  <th className="whitespace-nowrap px-6 py-4">Current Pending Dues</th>
                  <th className="whitespace-nowrap px-6 py-4">Last Paid Month</th>
                  <th className="whitespace-nowrap px-6 py-4">Paid This Month</th>
                  <th className="whitespace-nowrap px-6 py-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F1EADC]">
                {visibleItems.length ? visibleItems.map((item, index) => (
                  <tr key={item.student_id}>
                    <td className="px-6 py-4 font-semibold text-[#0D5C48]">{String((safePage - 1) * PAGE_SIZE + index + 1).padStart(2, "0")}</td>
                    <td className="px-6 py-4">
                      <p className="font-semibold text-[#063F32]">{item.student_name || "-"}</p>
                    </td>
                    <td className="px-6 py-4">
                      <p className="font-semibold text-[#063F32]">{item.parent_name || "-"}</p>
                    </td>
                    <td className="px-6 py-4 text-[#245C4F]">{item.student_email || item.parent_email || "-"}</td>
                    <td className="px-6 py-4 text-[#245C4F]">{item.class_level || "-"}</td>
                    <td className="px-6 py-4 text-[#245C4F]">{item.admission_no || "-"}</td>
                    <td className="px-6 py-4 font-semibold text-[#063F32]">{formatMoney(item.current_pending_dues)}</td>
                    <td className="px-6 py-4 text-[#245C4F]">{item.latest_month_label || "-"}</td>
                    <td className="px-6 py-4 text-[#245C4F]">{formatMoney(item.latest_this_month_paid)}</td>
                    <td className="px-6 py-4 text-right">
                      <button
                        type="button"
                        onClick={() => void openStudentHistory(item)}
                        className="whitespace-nowrap rounded-xl border border-[#2D8A6A]/20 bg-[#FAF7F0] px-3 py-2 text-xs font-semibold text-[#063F32] transition hover:bg-[#F1EADC]"
                      >
                        View All Fee Details
                      </button>
                    </td>
                  </tr>
                )) : (
                  <tr>
                    <td className="px-6 py-10 text-center text-[#245C4F]" colSpan={10}>{loading ? "Loading fee history..." : "No verified student records found."}</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {filteredItems.length > PAGE_SIZE ? (
            <PaginationControls page={safePage} pageSize={PAGE_SIZE} totalItems={filteredItems.length} onPageChange={setPage} />
          ) : null}
        </section>

        {selectedStudent ? (
          <ClientPortal targetId="coordinator-page-portal-root">
            <div className="absolute inset-x-0 top-0 z-[9999] isolate min-h-full overflow-visible bg-[#063F32]/45 px-4 py-10">
              <div className="mx-auto max-w-7xl rounded-[2rem] border border-[#2D8A6A]/15 bg-[#FAF7F0] p-6 shadow-[0_24px_80px_-36px_rgba(13,59,46,0.24)]">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="text-sm font-semibold uppercase tracking-[0.24em] text-[#C9A227]">Fee Details</p>
                    <div className="mt-3 space-y-2 md:space-y-0 text-sm text-[#245C4F] md:flex md:gap-10">
                      <p><span className="font-semibold text-[#063F32]">Student Name:</span> {selectedStudent.student_name || "-"}</p>
                      <p><span className="font-semibold text-[#063F32]">Parent Name:</span> {selectedStudent.parent_name || "-"}</p>
                      <p><span className="font-semibold text-[#063F32]">Class:</span> {selectedStudent.class_level || "-"}</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedStudent(null)}
                    className="rounded-xl border border-[#2D8A6A]/20 bg-[#FAF7F0] px-3 py-2 text-sm font-semibold text-[#063F32] transition hover:bg-[#F1EADC]"
                  >
                    Close
                  </button>
                </div>

                {historyError ? <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{historyError}</div> : null}
                {historyMessage ? <div className="mt-4 rounded-2xl border border-[#2D8A6A]/15 bg-[#EAF6EF] p-4 text-sm text-[#0D5C48]">{historyMessage}</div> : null}

                <div className="mt-6 grid gap-4 lg:grid-cols-[220px_220px_220px_minmax(0,1fr)]">
                  <div className="relative">
                    <p className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-[#0D5C48]">Popup column</p>
                    <select
                      value={historyColumnFilter}
                      onFocus={() => setHistoryColumnOpen(true)}
                      onBlur={() => setHistoryColumnOpen(false)}
                      onChange={(event) => setHistoryColumnFilter(event.target.value)}
                      className="w-full appearance-none rounded-2xl border border-[#2D8A6A]/20 bg-white px-4 py-3 pr-11 text-sm text-[#063F32] outline-none focus:border-[#2D8A6A]"
                    >
                      <option value="all">All columns</option>
                      <option value="month_label">Month</option>
                      <option value="voucher_no">Voucher No</option>
                      <option value="payment_status">Payment Status</option>
                    </select>
                    <ChevronDown className={`pointer-events-none absolute right-4 top-[calc(50%+14px)] h-4 w-4 -translate-y-1/2 text-[#0D5C48] transition-transform ${historyColumnOpen ? "rotate-180" : ""}`} />
                  </div>
                  <div className="relative">
                    <p className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-[#0D5C48]">Payment status</p>
                    <select
                      value={historyStatusFilter}
                      onFocus={() => setHistoryStatusOpen(true)}
                      onBlur={() => setHistoryStatusOpen(false)}
                      onChange={(event) => setHistoryStatusFilter(event.target.value)}
                      className="w-full appearance-none rounded-2xl border border-[#2D8A6A]/20 bg-white px-4 py-3 pr-11 text-sm text-[#063F32] outline-none focus:border-[#2D8A6A]"
                    >
                      <option value="all">All statuses</option>
                      <option value="verified">Verified</option>
                      <option value="submitted">Submitted</option>
                      <option value="rejected">Rejected</option>
                      <option value="unpaid">Unpaid</option>
                      <option value="not_submitted">Not Submitted</option>
                    </select>
                    <ChevronDown className={`pointer-events-none absolute right-4 top-[calc(50%+14px)] h-4 w-4 -translate-y-1/2 text-[#0D5C48] transition-transform ${historyStatusOpen ? "rotate-180" : ""}`} />
                  </div>
                  <div className="lg:col-span-2 relative">
                    <p className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-[#0D5C48]">Search</p>
                    <Search className="pointer-events-none absolute left-4 top-[calc(50%+14px)] h-4 w-4 -translate-y-1/2 text-[#0D5C48]" />
                    <input
                      value={historySearchTerm}
                      onChange={(event) => setHistorySearchTerm(event.target.value)}
                      placeholder="Search this student's fee history"
                      className="w-full rounded-2xl border border-[#2D8A6A]/20 bg-white py-3 pl-11 pr-4 text-sm text-[#063F32] outline-none focus:border-[#2D8A6A]"
                    />
                  </div>
                </div>

                <div className="mt-6 overflow-x-auto rounded-[1.75rem] border border-[#2D8A6A]/15 bg-[linear-gradient(180deg,rgba(255,255,255,0.96)_0%,rgba(250,247,240,0.98)_100%)]">
                  <table className="min-w-full text-left text-sm">
                    <thead className="bg-[linear-gradient(180deg,#FAF7F0_0%,#F1EADC_100%)] text-xs uppercase tracking-[0.18em] text-[#0D5C48]">
                      <tr>
                        <th className="whitespace-nowrap px-4 py-3">Month</th>
                        <th className="whitespace-nowrap px-4 py-3">Due Date</th>
                        <th className="whitespace-nowrap px-4 py-3">Voucher No</th>
                        <th className="whitespace-nowrap px-4 py-3">Previous Month Due</th>
                        <th className="whitespace-nowrap px-4 py-3">Current Month Fee</th>
                        <th className="whitespace-nowrap px-4 py-3">Total Amount</th>
                        <th className="whitespace-nowrap px-4 py-3">This Month Paid</th>
                        <th className="whitespace-nowrap px-4 py-3">Remaining Due</th>
                        <th className="whitespace-nowrap px-4 py-3">Payment Status</th>
                        <th className="whitespace-nowrap px-4 py-3">Payment Proof</th>
                        <th className="whitespace-nowrap px-4 py-3">Voucher PDF</th>
                        <th className="whitespace-nowrap px-4 py-3 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#F1EADC]">
                      {visibleHistoryItems.length ? visibleHistoryItems.map((row) => {
                        const isEditableHistoryRow = true;
                        const draft = drafts[row.id] || {
                          previous_month_due: moneyInputValue(row.previous_month_due),
                          discount_amount: moneyInputValue(row.discount_amount),
                          current_month_fee: moneyInputValue(row.current_month_fee),
                          this_month_paid: moneyInputValue(row.this_month_paid),
                        };
                        const regularFee = Number(row?.regular_fee_amount || 0);
                        const admissionFee = Number(row?.admission_fee_amount || 0);
                        const draftDiscount = Number(draft.discount_amount || 0);
                        const scholarshipAmount = Number(row?.scholarship_amount || 0);
                        const currentMonthFeeValue = Number(draft.current_month_fee || row.current_month_fee || 0);
                        const derivedTotal = regularFee + admissionFee - draftDiscount - scholarshipAmount;
                        const hasBreakdown = regularFee > 0 || admissionFee > 0 || draftDiscount > 0 || scholarshipAmount > 0;
                        const currentFeeParts = {
                          regularFee: hasBreakdown ? regularFee : 0,
                          admissionFee: hasBreakdown ? admissionFee : 0,
                          discount: hasBreakdown ? draftDiscount : 0,
                          scholarshipAmount: hasBreakdown ? scholarshipAmount : 0,
                          currentMonthFee: hasBreakdown ? derivedTotal : currentMonthFeeValue,
                        };
                        const previousMonthDueValue = Number(row.computedPreviousMonthDue ?? row.previous_month_due ?? draft.previous_month_due ?? 0);
                        const computed = computeAmounts(previousMonthDueValue, currentFeeParts.currentMonthFee, draft.this_month_paid);
                        return (
                          <tr key={row.id}>
                            <td className="px-4 py-4 font-semibold text-[#063F32]">{row.month_label || "-"}</td>
                            <td className="px-4 py-4 text-[#245C4F]">{formatDate(row.due_date)}</td>
                            <td className="px-4 py-4 text-[#245C4F]">{row.voucher_no || "-"}</td>
                            <td className="px-4 py-4">
                              <span className="text-[#245C4F]">{formatMoney(previousMonthDueValue)}</span>
                            </td>
                            <td className="px-4 py-4 align-top">
                              <div className="min-w-[320px] space-y-2 rounded-2xl border border-[#2D8A6A]/12 bg-white px-0 py-0 shadow-[0_12px_30px_-24px_rgba(13,59,46,0.14)]">
                                {hasBreakdown ? (
                                  <div className="flex flex-nowrap items-center rounded-2xl justify-between gap-1 overflow-x-auto bg-[#FAF7F0] px-2 py-2 text-[10px] text-[#245C4F]">
                                    <div className="min-w-[50px] text-center">
                                      <p className="text-[8px] font-semibold uppercase tracking-[0.1em] text-[#0D5C48]">Monthly</p>
                                      <p className="mt-0.5 whitespace-nowrap font-bold text-[#063F32]">{formatMoney(currentFeeParts.regularFee)}</p>
                                    </div>
                                    <span className="shrink-0 font-bold text-[#245C4F]">+</span>
                                    <div className="min-w-[50px] text-center">
                                      <p className="text-[8px] font-semibold uppercase tracking-[0.1em] text-[#0D5C48]">Admission</p>
                                      <p className="mt-0.5 whitespace-nowrap font-bold text-[#063F32]">{formatMoney(currentFeeParts.admissionFee)}</p>
                                    </div>
                                    {currentFeeParts.discount > 0 ? <>
                                      <span className="shrink-0 font-bold text-[#245C4F]">-</span>
                                      <div className="min-w-[50px] text-center">
                                        <p className="text-[8px] font-semibold uppercase tracking-[0.1em] text-[#0D5C48]">Discount</p>
                                        <p className="mt-0.5 whitespace-nowrap font-bold text-[#063F32]">{formatMoney(currentFeeParts.discount)}</p>
                                      </div>
                                    </> : null}
                                    {currentFeeParts.scholarshipAmount > 0 ? <>
                                      <span className="shrink-0 font-bold text-[#245C4F]">-</span>
                                      <div className="min-w-[50px] text-center">
                                        <p className="text-[8px] font-semibold uppercase tracking-[0.1em] text-[#0D5C48]">Scholarship</p>
                                        <p className="mt-0.5 whitespace-nowrap font-bold text-[#063F32]">{formatMoney(currentFeeParts.scholarshipAmount)}</p>
                                      </div>
                                    </> : null}
                                    <span className="shrink-0 font-bold text-[#245C4F]">=</span>
                                    <div className="min-w-[50px] text-center rounded-lg bg-[#0D5C48] px-1.5 py-1 text-[#FAF7F0]">
                                      <p className="text-[8px] font-semibold uppercase tracking-[0.1em] text-[#FFF5D6]">Total</p>
                                      <p className="mt-0.5 whitespace-nowrap text-xs font-bold leading-none">{formatMoney(currentFeeParts.currentMonthFee)}</p>
                                    </div>
                                  </div>
                                ) : (
                                  <div className="rounded-xl border border-[#F1EADC] bg-[#FAF7F0] px-3 py-2">
                                    <p className="text-[8px] font-semibold uppercase tracking-[0.1em] text-[#0D5C48]">Current Month Fee</p>
                                    <p className="mt-1 font-bold text-[#063F32]">{formatMoney(currentFeeParts.currentMonthFee)}</p>
                                  </div>
                                )}
                              </div>
                            </td>
                            <td className="px-4 py-4 font-semibold text-[#063F32]">{formatMoney(computed.total)}</td>
                            <td className="px-4 py-4">{isEditableHistoryRow ? <input value={draft.this_month_paid} onChange={(event) => setDrafts((current) => ({ ...current, [row.id]: { ...draft, this_month_paid: event.target.value } }))} type="number" min="0" className="w-28 rounded-xl border border-[#2D8A6A]/20 bg-white px-3 py-2 text-sm text-[#063F32] outline-none focus:border-[#2D8A6A]" /> : <span className="text-[#245C4F]">{formatMoney(draft.this_month_paid)}</span>}</td>
                            <td className="px-4 py-4 font-semibold text-[#063F32]">{formatMoney(computed.remaining)}</td>
                            <td className="px-4 py-4 text-[#245C4F]">{String(row.payment_status || "-").replace(/_/g, " ")}</td>
                            <td className="px-4 py-4 text-[#245C4F]">
                              {row.proof_file_url ? (
                                <a href={row.proof_file_url} target="_blank" rel="noreferrer" className="inline-flex overflow-hidden rounded-xl border border-[#F1EADC] bg-white">
                                  <img src={row.proof_file_url} alt={`Payment proof for ${row.voucher_no || row.month_label || "fee record"}`} className="h-14 w-14 object-cover" />
                                </a>
                              ) : (
                                <span>-</span>
                              )}
                            </td>
                            <td className="px-4 py-4 text-[#245C4F]">
                              {row.voucher_id ? (
                                <button
                                  type="button"
                                  onClick={() => void downloadVoucherPdf(row)}
                                  disabled={voucherPdfLoadingId === row.id}
                                  className="whitespace-nowrap rounded-xl border border-[#2D8A6A]/20 bg-white px-3 py-2 text-xs font-semibold text-[#063F32] transition hover:bg-[#F1EADC] disabled:opacity-60"
                                >
                                  {voucherPdfLoadingId === row.id ? "Downloading..." : "Download PDF"}
                                </button>
                              ) : (
                                <span>-</span>
                              )}
                            </td>
                            <td className="px-4 py-4 text-right">
                              {true ? (
                                <button
                                  type="button"
                                  onClick={() => void saveHistoryRow(row)}
                                  disabled={savingRowId === row.id}
                                  className="whitespace-nowrap rounded-xl bg-[#0D5C48] px-3 py-2 text-xs font-semibold text-[#FAF7F0] transition hover:bg-[#063F32] disabled:opacity-60"
                                >
                                  {savingRowId === row.id ? "Saving..." : "Save"}
                                </button>
                              ) : (
                                <span className="whitespace-nowrap text-xs font-medium text-[#245C4F]">Read only</span>
                              )}
                            </td>
                          </tr>
                        );
                      }) : (
                        <tr>
                          <td className="px-4 py-8 text-center text-[#245C4F]" colSpan={13}>{historyLoading ? "Loading student fee history..." : "No fee history rows found for this student."}</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                {filteredHistoryItems.length > PAGE_SIZE ? (
                  <PaginationControls page={safeHistoryPage} pageSize={PAGE_SIZE} totalItems={filteredHistoryItems.length} onPageChange={setHistoryPage} />
                ) : null}
              </div>
            </div>
          </ClientPortal>
        ) : null}
      </div>
    </div>
  );
}




