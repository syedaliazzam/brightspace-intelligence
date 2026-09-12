"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronDown } from "lucide-react";
import ClientPortal from "@/components/shared/ClientPortal";
import PaginationControls from "@/components/teacher/PaginationControls";
import { LeafSpinnerInline } from "@/components/shared/AshShajrahLoaders";

function formatDate(value) {
  if (!value) return "-";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString();
}

function formatMoney(value) {
  const amount = Number(value || 0);
  return `PKR ${amount.toLocaleString("en-PK")}`;
}

const STATUS_STYLES = {
  not_submitted: "bg-[#F1EADC] text-[#245C4F]",
  submitted: "bg-amber-50 text-amber-700",
  verified: "bg-emerald-50 text-emerald-700",
  rejected: "bg-rose-50 text-rose-700",
};

function formatStatus(value) {
  return String(value || "")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

export default function RegularFeeVouchersPage() {
  const PAGE_SIZE = 7;
  const [classes, setClasses] = useState([]);
  const [history, setHistory] = useState([]);
  const [paymentMethods, setPaymentMethods] = useState([]);
  const [studentsByClass, setStudentsByClass] = useState({});
  const [studentDiscounts, setStudentDiscounts] = useState({});
  const [form, setForm] = useState({ classId: "", dueDate: "", monthLabel: "", baseAmount: "", paymentMethodId: "" });
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [detailItem, setDetailItem] = useState(null);
  const [classOpen, setClassOpen] = useState(false);
  const [approveRow, setApproveRow] = useState(null);
  const [approveAmount, setApproveAmount] = useState("");
  const [approveProofFile, setApproveProofFile] = useState(null);
  const [approvePending, setApprovePending] = useState(false);
  const [approveError, setApproveError] = useState("");
  const [detailPage, setDetailPage] = useState(1);
  const [historyPage, setHistoryPage] = useState(1);

  async function load() {
    setLoading(true);
    try {
      const response = await fetch("/api/coordinator/regular-fee-vouchers", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.message || "Unable to load regular fee vouchers.");
      setClasses(data.classes || []);
      setHistory(data.history || []);
      setPaymentMethods(data.paymentMethods || []);
      setStudentsByClass(data.studentsByClass || {});
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load regular fee vouchers.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void load();
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!paymentMethods.length) return;
    if (form.paymentMethodId) return;
    const firstMethod = paymentMethods[0];
    if (!firstMethod?.id) return;
    const timer = window.setTimeout(() => {
      setForm((current) => (current.paymentMethodId ? current : { ...current, paymentMethodId: firstMethod.id }));
    }, 0);
    return () => window.clearTimeout(timer);
  }, [paymentMethods, form.paymentMethodId]);

  function closeSelectState(setter) {
    window.setTimeout(() => setter(false), 0);
  }

  const selectedClass = useMemo(() => classes.find((item) => item.id === form.classId), [classes, form.classId]);
  const selectedClassStudents = useMemo(() => studentsByClass[form.classId] || [], [form.classId, studentsByClass]);

  function handleClassChange(value) {
    const nextClass = classes.find((item) => item.id === value) || null;
    const nextStudents = studentsByClass[value] || [];
    const defaultDiscounts = nextStudents.reduce((acc, student) => {
      const discount = Number(student.default_discount_amount || 0);
      if (student.student_id && discount > 0) {
        acc[student.student_id] = String(discount);
      }
      return acc;
    }, {});
    setForm((current) => ({
      ...current,
      classId: value,
      baseAmount: nextClass?.regular_fee_amount ? String(nextClass.regular_fee_amount) : "",
    }));
    setStudentDiscounts(defaultDiscounts);
  }

  function updateStudentDiscount(studentId, value) {
    const baseAmount = Number(form.baseAmount || 0);
    const cleaned = String(value || "").replace(/[^0-9.]/g, "");
    const [whole, ...decimalParts] = cleaned.split(".");
    const normalized = `${whole}${decimalParts.length ? `.${decimalParts.join("")}` : ""}`;
    const amount = Math.max(0, Math.min(baseAmount || Number.MAX_SAFE_INTEGER, Number(normalized || 0)));
    setStudentDiscounts((current) => ({
      ...current,
      [studentId]: normalized === "" ? "" : String(amount),
    }));
  }

  function getStudentDiscount(studentId) {
    return Number(studentDiscounts[studentId] || 0);
  }

  function getStudentTotalPayable(student) {
    const baseAmount = Number(form.baseAmount || 0);
    const pendingDue = Number(student?.current_pending_due || 0);
    const discount = getStudentDiscount(student?.student_id);
    return Math.max(0, baseAmount - discount) + pendingDue;
  }

  const detailItems = useMemo(() => {
    const items = Array.isArray(detailItem?.items) ? detailItem.items : [];
    const start = (detailPage - 1) * PAGE_SIZE;
    return items.slice(start, start + PAGE_SIZE);
  }, [detailItem, detailPage]);

  const detailTotalItems = Array.isArray(detailItem?.items) ? detailItem.items.length : 0;
  const historyItems = useMemo(() => {
    const start = (historyPage - 1) * PAGE_SIZE;
    return history.slice(start, start + PAGE_SIZE);
  }, [history, historyPage]);

  const historyTotalItems = history.length;

  const approveProofLabel = useMemo(() => {
    if (approveProofFile?.name) return approveProofFile.name;
    if (approveRow?.proof_file_path) return "Existing proof available";
    return "No file chosen";
  }, [approveProofFile, approveRow]);

  const approveProofPreview = useMemo(() => {
    if (!approveProofFile) return null;
    const isImage = approveProofFile.type.startsWith("image/");
    const previewUrl = isImage ? URL.createObjectURL(approveProofFile) : null;
    return { name: approveProofFile.name, isImage, previewUrl };
  }, [approveProofFile]);

  async function submitApprovePayment(event) {
    event.preventDefault();
    if (!approveRow?.voucher_id && !approveRow?.fee_submission_id) return;

    setApprovePending(true);
    setApproveError("");

    try {
      const formData = new FormData();
      formData.append("action", "approve");
      formData.append(
        "paidAmount",
        String(approveAmount || approveRow.paid_amount || approveRow.base_amount || approveRow.current_pending_due || 0)
      );
      if (approveProofFile) {
        formData.append("proofFile", approveProofFile);
      }

      const approvalId = approveRow.fee_submission_id || approveRow.voucher_id;
      const response = await fetch(`/api/coordinator/payments/${encodeURIComponent(approvalId)}/verify`, {
        method: "POST",
        body: formData,
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data?.message || "Unable to approve payment.");
      }

      setApproveRow(null);
      setApproveAmount("");
      setApproveProofFile(null);
      setApproveError("");
      window.location.reload();
    } catch (approveError) {
      setApproveError(approveError instanceof Error ? approveError.message : "Unable to approve payment.");
    } finally {
      setApprovePending(false);
    }
  }

  function openDetailItem(item) {
    setDetailItem(item);
    setDetailPage(1);
  }

  function handleOpenDetailItem(item) {
    setHistoryPage(1);
    openDetailItem(item);
  }

  async function submit(event) {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    try {
          const response = await fetch("/api/coordinator/regular-fee-vouchers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, studentDiscounts }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.message || "Unable to create vouchers.");
      setForm({ classId: "", dueDate: "", monthLabel: "", baseAmount: "", paymentMethodId: "" });
      setStudentDiscounts({});
      await load();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Unable to create vouchers.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#FAF7F0]">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(201,162,39,0.12),transparent_35%),radial-gradient(circle_at_top_right,rgba(45,138,106,0.12),transparent_32%),linear-gradient(180deg,#FAF7F0_0%,#F7F1E3_100%)]" />
      <div className="relative mx-auto max-w-7xl space-y-6 px-4 py-4 sm:px-6 lg:px-8">
        <section className="relative overflow-hidden rounded-[2rem] border border-[#2D8A6A]/15 bg-[linear-gradient(135deg,rgba(13,59,46,0.98),rgba(13,92,72,0.94))] p-6 text-[#FAF7F0] shadow-[0_24px_80px_-36px_rgba(13,59,46,0.32)] sm:p-8">
          <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(135deg,rgba(13,59,46,0.98),rgba(13,92,72,0.94))]" />
          <div className="relative">
            <p className="inline-flex rounded-full border border-[#E4C766]/30 bg-[#FFF5D6]/12 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.28em] text-[#FFF5D6]">
              Coordinator portal
            </p>
            <h1 className="mt-4 font-display text-3xl font-bold tracking-tight text-[#FAF7F0] sm:text-4xl">Regular monthly fee vouchers</h1>
            <p className="mt-3 text-sm leading-7 text-[#EAF6EF] sm:text-base">Generate regular monthly fee vouchers for one class and keep batch history in one place.</p>
          </div>
        </section>

        {error ? <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{error}</div> : null}

        <section className="rounded-[2rem] border border-[#2D8A6A]/15 bg-[linear-gradient(180deg,rgba(255,255,255,0.96)_0%,rgba(250,247,240,0.98)_100%)] p-5 shadow-[0_20px_70px_-36px_rgba(13,59,46,0.18)] backdrop-blur-xl sm:p-6">
          <form className="grid min-w-0 gap-4 md:grid-cols-4" onSubmit={submit}>
            <label className="block">
              <span className="mb-2 block text-sm font-medium text-[#245C4F]">Class</span>
              <div className="relative">
                <select
                  value={form.classId}
                  onMouseDown={() => setClassOpen((current) => !current)}
                  onFocus={() => setClassOpen(true)}
                  onBlur={() => closeSelectState(setClassOpen)}
                  onChange={(e) => handleClassChange(e.target.value)}
                  className="w-full appearance-none rounded-2xl border border-[#2D8A6A]/20 bg-[#FAF7F0] px-4 py-3 pr-11 text-sm text-[#063F32] outline-none transition focus:border-[#2D8A6A] focus:bg-white focus:ring-4 focus:ring-[#FFF5D6]"
                  required
                >
                  <option value="">Select class</option>
                  {classes.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.title}
                      {item.regular_fee_amount ? ` - ${formatMoney(item.regular_fee_amount)}` : ""}
                    </option>
                  ))}
                </select>
                <ChevronDown
                  className={`pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#0D5C48] transition-transform duration-200 ${
                    classOpen ? "rotate-180" : "rotate-0"
                  }`}
                />
              </div>
            </label>
            <label className="block">
              <span className="mb-2 block text-sm font-medium text-[#245C4F]">Due date</span>
              <input type="date" value={form.dueDate} onChange={(e) => setForm((c) => ({ ...c, dueDate: e.target.value }))} className="w-full rounded-2xl border border-[#2D8A6A]/20 bg-[#FAF7F0] px-4 py-3 text-sm text-[#063F32] outline-none transition focus:border-[#2D8A6A] focus:bg-white focus:ring-4 focus:ring-[#FFF5D6]" required />
            </label>
            <label className="block">
              <span className="mb-2 block text-sm font-medium text-[#245C4F]">Month label</span>
              <input value={form.monthLabel} onChange={(e) => setForm((c) => ({ ...c, monthLabel: e.target.value }))} placeholder="June 2026" className="w-full rounded-2xl border border-[#2D8A6A]/20 bg-[#FAF7F0] px-4 py-3 text-sm text-[#063F32] outline-none transition focus:border-[#2D8A6A] focus:bg-white focus:ring-4 focus:ring-[#FFF5D6]" />
            </label>
            <label className="block">
              <span className="mb-2 block text-sm font-medium text-[#245C4F]">Regular monthly fee</span>
              <input
                type="number"
                min="1"
                value={form.baseAmount}
                onChange={(e) => setForm((current) => ({ ...current, baseAmount: e.target.value }))}
                className="w-full rounded-2xl border border-[#2D8A6A]/20 bg-[#FAF7F0] px-4 py-3 text-sm text-[#063F32] outline-none transition focus:border-[#2D8A6A] focus:bg-white focus:ring-4 focus:ring-[#FFF5D6]"
                required
              />
            </label>
            <div className="md:col-span-4">
              <p className="mb-3 block text-sm font-medium text-[#245C4F]">Bank / Payment Method</p>
                <div className="grid gap-3 [@media(min-width:600px)]:grid-cols-2">
                {paymentMethods.map((method) => {
                  return (
                      <button
                        key={method.id}
                        type="button"
                        onClick={() => setForm((current) => ({ ...current, paymentMethodId: method.id }))}
                        className="rounded-2xl border border-[#0D5C48] bg-[#EAF6EF] px-4 py-4 text-left shadow-[0_12px_32px_-22px_rgba(13,92,72,0.35)] transition hover:bg-[#EFF9F1]"
                      >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-[#063F32]">{method.name}</p>
                          {method.bank_name ? <p className="mt-1 text-xs text-[#245C4F]">Bank: {method.bank_name}</p> : null}
                        </div>
                      </div>
                      <div className="mt-3 space-y-1 text-xs text-[#245C4F]">
                        {method.account_title ? <p><span className="font-medium text-[#063F32]">Account title:</span> {method.account_title}</p> : null}
                        {method.account_number ? <p><span className="font-medium text-[#063F32]">Account number:</span> {method.account_number}</p> : null}
                        {method.iban ? <p><span className="font-medium text-[#063F32]">IBAN:</span> {method.iban}</p> : null}
                        {method.branch_code ? <p><span className="font-medium text-[#063F32]">Branch code:</span> {method.branch_code}</p> : null}
                        {method.instructions ? <p><span className="font-medium text-[#063F32]">Instructions:</span> {method.instructions}</p> : null}
                      </div>
                    </button>
                  );
                })}
              </div>
              {!paymentMethods.length ? <p className="mt-2 text-sm text-[#245C4F]">No payment methods available.</p> : null}
            </div>
            {form.classId ? (
              <div className="min-w-0 md:col-span-4">
                <div className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
                  <div>
                    <p className="text-sm font-semibold text-[#063F32]">Student fee details</p>
                    <p className="text-xs text-[#245C4F]">Add a discount only for students who need it in this monthly voucher.</p>
                  </div>
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#0D5C48]">
                    {selectedClassStudents.length} students
                  </p>
                </div>
                <div className="w-full max-w-full overflow-x-auto rounded-[1.5rem] border border-[#2D8A6A]/15 bg-white">
                  <table className="min-w-[980px] w-full text-left text-sm">
                    <thead className="bg-[linear-gradient(180deg,#FAF7F0_0%,#F1EADC_100%)] text-xs uppercase tracking-[0.16em] text-[#0D5C48]">
                      <tr>
                        <th className="px-4 py-3">Student</th>
                        <th className="px-4 py-3">Parent</th>
                        <th className="px-4 py-3">Monthly Fee</th>
                        <th className="px-4 py-3">Pending Due</th>
                        <th className="px-4 py-3">Discount</th>
                        <th className="px-4 py-3">Total Payable</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#F1EADC]">
                      {selectedClassStudents.length ? selectedClassStudents.map((student) => {
                        const discount = getStudentDiscount(student.student_id);
                        return (
                          <tr key={student.student_id}>
                            <td className="px-4 py-4">
                              <p className="font-semibold text-[#063F32]">{student.student_name || "-"}</p>
                              <p className="mt-1 text-xs text-[#245C4F]">{student.student_email || student.parent_email || "-"}</p>
                            </td>
                            <td className="px-4 py-4 text-[#245C4F]">
                              <p>{student.parent_name || "-"}</p>
                              <p className="mt-1 text-xs">{student.parent_phone || student.student_phone || "-"}</p>
                            </td>
                            <td className="px-4 py-4 font-semibold text-[#063F32]">{formatMoney(form.baseAmount)}</td>
                            <td className="px-4 py-4 text-[#245C4F]">{formatMoney(student.current_pending_due || 0)}</td>
                            <td className="px-4 py-4">
                              <input
                                type="number"
                                min="0"
                                max={Number(form.baseAmount || 0) || undefined}
                                step="0.01"
                                value={studentDiscounts[student.student_id] ?? ""}
                                onChange={(event) => updateStudentDiscount(student.student_id, event.target.value)}
                                placeholder="0"
                                className="w-32 rounded-xl border border-[#2D8A6A]/20 bg-[#FAF7F0] px-3 py-2 text-sm font-semibold text-[#063F32] outline-none transition focus:border-[#2D8A6A] focus:bg-white focus:ring-4 focus:ring-[#FFF5D6]"
                              />
                              {discount > 0 ? (
                                <p className="mt-1 text-xs text-[#245C4F]">
                                  {Number(form.baseAmount || 0) > 0 ? `${((discount / Number(form.baseAmount || 1)) * 100).toFixed(2)}%` : "Discount added"}
                                </p>
                              ) : null}
                            </td>
                            <td className="px-4 py-4 font-semibold text-[#063F32]">{formatMoney(getStudentTotalPayable(student))}</td>
                          </tr>
                        );
                      }) : (
                        <tr>
                          <td colSpan={6} className="px-4 py-8 text-center text-[#245C4F]">
                            No verified students found for this class.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : null}
            <div className="flex items-end justify-start md:col-span-2">
              <button type="submit" disabled={submitting || !selectedClass} className="rounded-2xl bg-[#0D5C48] px-5 py-3 text-sm font-semibold text-[#FAF7F0] transition hover:bg-[#063F32] disabled:opacity-60">{submitting ? "Generating..." : "Generate vouchers"}</button>
            </div>
          </form>
        </section>

        <section className="rounded-[2rem] border border-[#2D8A6A]/15 bg-[linear-gradient(180deg,rgba(255,255,255,0.96)_0%,rgba(250,247,240,0.98)_100%)] p-5 shadow-[0_20px_70px_-36px_rgba(13,59,46,0.18)] backdrop-blur-xl sm:p-6">
          <h2 className="text-xl font-semibold text-[#063F32]">Batch history</h2>
          <div className="mt-4 overflow-hidden rounded-[1.75rem] border border-[#2D8A6A]/15 bg-[linear-gradient(180deg,rgba(255,255,255,0.96)_0%,rgba(250,247,240,0.98)_100%)]">
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-[linear-gradient(180deg,#FAF7F0_0%,#F1EADC_100%)] text-xs uppercase tracking-[0.18em] text-[#0D5C48]">
                  <tr><th className="px-6 py-4">Batch</th><th className="px-6 py-4">Class</th><th className="px-6 py-4">Month</th><th className="px-6 py-4">Due</th><th className="px-6 py-4">Students</th><th className="px-6 py-4">Total</th><th className="px-6 py-4">Status</th><th className="px-6 py-4">Action</th></tr>
                </thead>
                <tbody className="divide-y divide-[#F1EADC]">
                  {historyItems.length ? historyItems.map((item) => (
                    <tr key={item.id}>
                      <td className="px-6 py-4 font-semibold text-[#063F32]">{item.batch_no}</td>
                      <td className="px-6 py-4 text-[#245C4F]">{item.class_title}</td>
                      <td className="px-6 py-4 text-[#245C4F]">{item.month_label || "-"}</td>
                      <td className="px-6 py-4 text-[#245C4F]">{formatDate(item.due_date)}</td>
                      <td className="px-6 py-4 text-[#245C4F]">{item.student_count}</td>
                      <td className="px-6 py-4 text-[#245C4F]">{formatMoney(item.total_amount)}</td>
                      <td className="px-6 py-4 text-[#245C4F]">{item.status}</td>
                      <td className="px-6 py-4"><button type="button" onClick={() => handleOpenDetailItem(item)} className="rounded-xl border border-[#2D8A6A]/20 bg-[#FAF7F0] px-3 py-2 text-xs font-semibold text-[#063F32] transition hover:bg-[#F1EADC]">View</button></td>
                    </tr>
                  )) : <tr><td className="px-6 py-8 text-center text-[#245C4F]" colSpan={8}>{loading ? "Loading..." : "No regular fee voucher batches found."}</td></tr>}
                </tbody>
              </table>
            </div>
            {historyTotalItems > PAGE_SIZE ? (
              <div className="mt-4">
                <PaginationControls
                  page={historyPage}
                  pageSize={PAGE_SIZE}
                  totalItems={historyTotalItems}
                  onPageChange={setHistoryPage}
                />
              </div>
            ) : null}
          </div>
        </section>

        {detailItem ? (
          <ClientPortal targetId="coordinator-page-portal-root">
            <div className="absolute inset-x-0 top-0 z-[9999] isolate min-h-full overflow-visible bg-[#063F32]/45 px-4 py-10">
              <div className="mx-auto max-w-4xl rounded-[2rem] border border-[#2D8A6A]/15 bg-[#FAF7F0] p-6 shadow-[0_24px_80px_-36px_rgba(13,59,46,0.24)]">
                <div className="flex items-center justify-between">
                  <div><h3 className="text-2xl font-semibold text-[#063F32]">{detailItem.batch_no}</h3><p className="text-sm text-[#245C4F]">{detailItem.class_title}</p></div>
                  <button type="button" onClick={() => setDetailItem(null)} className="rounded-xl border border-[#2D8A6A]/20 bg-[#FAF7F0] px-3 py-2 text-sm font-semibold text-[#063F32] transition hover:bg-[#F1EADC]">Close</button>
                </div>
                <div className="mt-4 grid gap-3 md:grid-cols-4 text-sm">
                  <div><p className="text-[#245C4F]">Month</p><p className="font-semibold text-[#063F32]">{detailItem.month_label || "-"}</p></div>
                  <div><p className="text-[#245C4F]">Due date</p><p className="font-semibold text-[#063F32]">{formatDate(detailItem.due_date)}</p></div>
                  <div><p className="text-[#245C4F]">Students</p><p className="font-semibold text-[#063F32]">{detailItem.student_count}</p></div>
                  <div><p className="text-[#245C4F]">Total</p><p className="font-semibold text-[#063F32]">{formatMoney(detailItem.total_amount)}</p></div>
                </div>
                <p className="mt-5 text-sm font-semibold text-[#063F32]">Student voucher details</p>
                <div className="mt-4 overflow-x-auto rounded-[1.75rem] border border-[#2D8A6A]/15 bg-[linear-gradient(180deg,rgba(255,255,255,0.96)_0%,rgba(250,247,240,0.98)_100%)]">
                  <table className="min-w-full text-left text-sm">
                    <thead className="bg-[linear-gradient(180deg,#FAF7F0_0%,#F1EADC_100%)] text-xs uppercase tracking-[0.18em] text-[#0D5C48]">
                      <tr>
                        <th className="px-4 py-3">Student</th>
                        <th className="px-4 py-3">Email</th>
                        <th className="px-4 py-3">Voucher No</th>
                        <th className="px-4 py-3">Phone</th>
                        <th className="px-4 py-3">Monthly Fee</th>
                        <th className="px-4 py-3">Current Pending Due</th>
                        <th className="px-4 py-3">Discount</th>
                        <th className="px-4 py-3">Total Amount</th>
                        <th className="px-4 py-3">Payment Status</th>
                        <th className="px-4 py-3">Voucher Status</th>
                        <th className="px-4 py-3 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#F1EADC]">
                      {detailItems.length ? detailItems.map((row) => (
                        <tr key={row.id}>
                          <td className="px-4 py-4">
                            <p className="font-semibold text-[#063F32]">{row.student_name || "-"}</p>
                          </td>
                          <td className="px-4 py-4 text-[#245C4F]">
                            {row.student_email || row.parent_email || "-"}
                          </td>
                          <td className="px-4 py-4 text-[#245C4F]">{row.voucher_no || "-"}</td>
                          <td className="px-4 py-4 text-[#245C4F]">{row.student_phone || row.parent_phone || "-"}</td>
                          <td className="px-4 py-4 text-[#245C4F]">{formatMoney(row.base_amount)}</td>
                          <td className="px-4 py-4 text-[#245C4F]">{formatMoney(row.current_pending_due || 0)}</td>
                          <td className="px-4 py-4 text-[#245C4F]">{formatMoney(row.discount_amount || 0)}</td>
                          <td className="px-4 py-4 font-semibold text-[#063F32]">{formatMoney(row.total_amount || (Number(row.base_amount || 0) + Number(row.current_pending_due || 0) - Number(row.discount_amount || 0)))}</td>
                          <td className="px-4 py-4">
                            <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${STATUS_STYLES[String(row.payment_status || "not_submitted").toLowerCase()] || STATUS_STYLES.not_submitted}`}>
                              {formatStatus(row.payment_status || "not_submitted")}
                            </span>
                          </td>
                          <td className="px-4 py-4">
                            <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${STATUS_STYLES[String(row.voucher_status || "not_submitted").toLowerCase()] || STATUS_STYLES.not_submitted}`}>
                              {formatStatus(row.voucher_status || "not_submitted")}
                            </span>
                          </td>
                            <td className="px-4 py-4 text-right">
                              {["pending", "not_submitted"].includes(String(row.payment_status || "").toLowerCase()) && (row.fee_submission_id || row.voucher_id) && String(row.voucher_status || "").toLowerCase() !== "submitted" ? (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setApproveRow(row);
                                    setApproveAmount(String(row.paid_amount || row.total_amount || row.base_amount || ""));
                                    setApproveProofFile(null);
                                    setApproveError("");
                                  }}
                                  className="whitespace-nowrap rounded-xl bg-[#0D5C48] px-3 py-2 text-xs font-semibold text-[#FAF7F0] transition hover:bg-[#063F32]"
                                >
                                  Approve payment
                                </button>
                              ) : null}
                            </td>
                        </tr>
                      )) : (
                        <tr>
                          <td className="px-4 py-6 text-center text-[#245C4F]" colSpan={11}>No student voucher rows available.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
                {detailTotalItems > PAGE_SIZE ? (
                  <div className="mt-4">
                    <PaginationControls
                      page={detailPage}
                      pageSize={PAGE_SIZE}
                      totalItems={detailTotalItems}
                      onPageChange={setDetailPage}
                    />
                  </div>
                ) : null}
              </div>
            </div>
          </ClientPortal>
        ) : null}

        {approveRow ? (
          <ClientPortal targetId="coordinator-page-portal-root">
            <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-[#063F32]/45 px-4 pt-10 pb-10 backdrop-blur-sm">
              <div className="w-full max-w-2xl rounded-[2rem] border border-[#2D8A6A]/15 bg-[#FAF7F0] p-6 shadow-[0_24px_80px_-36px_rgba(13,59,46,0.24)] sm:p-8">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-sm font-semibold uppercase tracking-[0.24em] text-[#0D5C48]">Approve payment</p>
                    <h3 className="mt-2 text-xl font-semibold text-[#063F32]">{approveRow.voucher_no || "Monthly voucher"}</h3>
                    <p className="mt-1 text-sm text-[#245C4F]">{approveRow.student_name || ""}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setApproveRow(null)}
                    className="rounded-xl border border-[#2D8A6A]/20 bg-white px-3 py-2 text-sm font-semibold text-[#063F32]"
                  >
                    Close
                  </button>
                </div>
                <form className="mt-6 grid gap-4" onSubmit={submitApprovePayment}>
                  <label className="block">
                    <span className="mb-2 block text-sm font-medium text-[#245C4F]">Amount paid</span>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={approveAmount}
                      onChange={(event) => setApproveAmount(event.target.value)}
                      className="w-full rounded-2xl border border-[#2D8A6A]/20 bg-white px-4 py-3 text-sm text-[#063F32] outline-none focus:border-[#2D8A6A] focus:ring-4 focus:ring-[#FFF5D6]"
                      required
                    />
                  </label>
                  <label className="block">
                    <span className="mb-2 block text-sm font-medium text-[#245C4F]">Payment proof</span>
                    <input
                      type="file"
                      accept="image/*,application/pdf"
                      onChange={(event) => setApproveProofFile(event.target.files?.[0] || null)}
                      className="w-full rounded-2xl border border-[#2D8A6A]/20 bg-white px-4 py-3 text-sm text-[#063F32] file:mr-4 file:rounded-xl file:border-0 file:bg-[#EAF6EF] file:px-4 file:py-2 file:text-sm file:font-semibold file:text-[#0D5C48]"
                    />
                    <p className="mt-2 text-xs font-medium text-[#245C4F]">Selected file: {approveProofLabel}</p>
                    {approveProofPreview ? (
                      <div className="mt-3 rounded-2xl border border-[#2D8A6A]/15 bg-white p-3">
                        {approveProofPreview.isImage ? (
                          <img
                            src={approveProofPreview.previewUrl}
                            alt={approveProofPreview.name}
                            className="mt-2 h-32 w-full rounded-xl object-contain"
                          />
                        ) : (
                          <p className="mt-2 text-xs text-[#245C4F]">PDF selected, preview available after upload.</p>
                        )}
                      </div>
                    ) : null}
                  </label>
                  {approveError ? (
                    <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                      {approveError}
                    </div>
                  ) : null}
                  <div className="flex justify-end gap-3">
                    <button
                      type="button"
                      onClick={() => setApproveRow(null)}
                      className="rounded-2xl border border-[#2D8A6A]/20 bg-white px-5 py-3 text-sm font-semibold text-[#063F32]"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={approvePending}
                      className="inline-flex items-center justify-center rounded-2xl bg-[#0D5C48] px-5 py-3 text-sm font-semibold text-[#FAF7F0] disabled:opacity-60"
                    >
                      {approvePending ? (
                        <span className="inline-flex items-center gap-2">
                          <LeafSpinnerInline className="h-4 w-4 border-[#FAF7F0]/40 border-t-[#FAF7F0]" />
                          Approving...
                        </span>
                      ) : (
                        "Approve payment"
                      )}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </ClientPortal>
        ) : null}
      </div>
    </div>
  );
}
