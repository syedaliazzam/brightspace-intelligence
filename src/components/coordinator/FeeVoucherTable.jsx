"use client";

import { motion } from "framer-motion";
import { useState } from "react";
import { jsPDF } from "jspdf";
import FeeVoucherPreviewModal from "@/components/coordinator/FeeVoucherPreviewModal";

const STATUS_STYLES = {
  unpaid: "bg-slate-100 text-slate-700",
  submitted: "bg-amber-50 text-amber-700",
  verified: "bg-emerald-50 text-emerald-700",
  rejected: "bg-rose-50 text-rose-700",
  expired: "bg-violet-50 text-violet-700",
  new_lead: "bg-sky-50 text-sky-700",
  voucher_created: "bg-amber-50 text-amber-700",
  fee_submitted: "bg-violet-50 text-violet-700",
  fee_verified: "bg-emerald-50 text-emerald-700",
  access_granted: "bg-teal-50 text-teal-700",
  pending_clarification: "bg-orange-50 text-orange-700",
};

function formatStatus(value) {
  return String(value || "")
    .split("_")
    .filter(Boolean)
    .map((part) => part[0].toUpperCase() + part.slice(1))
    .join(" ");
}

function formatDate(value) {
  if (!value) {
    return "No due date";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "Invalid date";
  }

  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
  }).format(date);
}

function getDisplayStatus(voucher) {
  return voucher?.lead_status || voucher?.voucher_status || voucher?.status || "";
}

function getDisplayBankName(voucher) {
  return (
    voucher?.bank_name ||
    voucher?.payment_method_details?.bank_name ||
    voucher?.payment_method ||
    "Payment method unavailable"
  );
}

function getDisplayPaymentMethod(voucher) {
  return (
    voucher?.payment_method_name ||
    voucher?.payment_method_details?.name ||
    voucher?.payment_method ||
    "Payment method unavailable"
  );
}

function getPaymentSubmitLink(voucher) {
  const voucherNo = String(voucher?.voucher_no || "").trim();
  if (!voucherNo) return "";
  return `${window.location.origin.replace(/\/+$/, "")}/payment/${encodeURIComponent(voucherNo)}`;
}

async function fetchVoucherDetails(voucherId) {
  if (!voucherId) return null;

  try {
    const response = await fetch(`/api/coordinator/fee-vouchers/${voucherId}`, {
      cache: "no-store",
    });
    const data = await response.json().catch(() => null);
    return data?.item || null;
  } catch {
    return null;
  }
}

function normalizeVoucherForPdf(voucher) {
  const paymentMethodDetails = voucher?.payment_method_details || {};
  const amount = Number(voucher?.amount || 0);
  const regularFeeAmount = Number(voucher?.regular_fee_amount || 0);
  const otherFeeAmount = Number(voucher?.admission_fee_amount || 0);
  const subtotalAmount = Number(voucher?.subtotal_amount || regularFeeAmount + otherFeeAmount);
  const discountPercent = Number(voucher?.discount_percent || 0);
  const discountAmount = Number(voucher?.discount_amount || 0);
  const totalAmount = Number(voucher?.total_amount || subtotalAmount - discountAmount || amount);
  return {
    ...voucher,
    amount,
    class_level: voucher?.class_level || voucher?.grade_level || voucher?.course_title || "-",
    payment_method_name:
      voucher?.payment_method_name ||
      paymentMethodDetails.name ||
      voucher?.payment_method ||
      "",
    bank_name: voucher?.bank_name || paymentMethodDetails.bank_name || "",
    account_title: voucher?.account_title || paymentMethodDetails.account_title || "",
    account_number: voucher?.account_number || paymentMethodDetails.account_number || "",
    iban: voucher?.iban || paymentMethodDetails.iban || "",
    branch_code: voucher?.branch_code || paymentMethodDetails.branch_code || "",
    payment_method_instructions:
      voucher?.payment_method_instructions ||
      voucher?.payment_instructions ||
      paymentMethodDetails.instructions ||
      "",
    payment_method_details: {
      name:
        voucher?.payment_method_name ||
        paymentMethodDetails.name ||
        voucher?.payment_method ||
        "",
      bank_name: voucher?.bank_name || paymentMethodDetails.bank_name || "",
      account_title: voucher?.account_title || paymentMethodDetails.account_title || "",
      account_number: voucher?.account_number || paymentMethodDetails.account_number || "",
      iban: voucher?.iban || paymentMethodDetails.iban || "",
      branch_code: voucher?.branch_code || paymentMethodDetails.branch_code || "",
      instructions:
        voucher?.payment_method_instructions ||
        voucher?.payment_instructions ||
        paymentMethodDetails.instructions ||
        "",
    },
    regular_fee_amount: regularFeeAmount,
    admission_fee_amount: otherFeeAmount,
    subtotal_amount: subtotalAmount,
    discount_percent: discountPercent,
    discount_amount: discountAmount,
    total_amount: totalAmount,
  };
}

function formatMoney(value) {
  const amount = Number(value || 0);
  return `PKR ${Number.isFinite(amount) ? amount.toLocaleString("en-PK") : "0"}`;
}

function buildVoucherPrintHtml(voucher) {
  const safe = (value) =>
    String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");

  const bankName = getDisplayBankName(voucher);
  const paymentMethod = voucher?.payment_method_details || voucher || {};
  const paymentMethodName =
    voucher?.payment_method_name ||
    paymentMethod.name ||
    voucher?.payment_method ||
    "Payment method unavailable";
  const regularFeeAmount = Number(voucher?.regular_fee_amount || 0);
  const otherFeeAmount = Number(voucher?.admission_fee_amount || 0);
  const subtotalAmount = Number(voucher?.subtotal_amount || regularFeeAmount + otherFeeAmount);
  const discountPercent = Number(voucher?.discount_percent || 0);
  const discountAmount = Number(voucher?.discount_amount || 0);
  const totalAmount = Number(voucher?.total_amount || subtotalAmount - discountAmount);
  const feeRows = [
    voucher?.regular_fee_applied && regularFeeAmount > 0
      ? `<tr><td style="padding:10px 0;color:#64748b;">Regular Fee</td><td style="padding:10px 0;text-align:right;font-weight:700;">${safe(formatMoney(regularFeeAmount))}</td></tr>`
      : "",
    otherFeeAmount > 0
      ? `<tr><td style="padding:10px 0;color:#64748b;">Other Fee</td><td style="padding:10px 0;text-align:right;font-weight:700;">${safe(formatMoney(otherFeeAmount))}</td></tr>`
      : "",
    `<tr><td style="padding:10px 0;color:#64748b;">Subtotal</td><td style="padding:10px 0;text-align:right;font-weight:700;">${safe(formatMoney(subtotalAmount))}</td></tr>`,
    `<tr><td style="padding:10px 0;color:#64748b;">Discount on Regular Fee</td><td style="padding:10px 0;text-align:right;font-weight:700;">${safe(`${discountPercent}% (${formatMoney(discountAmount)})`)}</td></tr>`,
    `<tr><td style="padding:10px 0;color:#64748b;">Total Payable</td><td style="padding:10px 0;text-align:right;font-weight:800;">${safe(formatMoney(totalAmount))}</td></tr>`,
  ]
    .filter(Boolean)
    .join("");

  return `
    <html>
      <head>
        <title>${safe(voucher.voucher_no || "Voucher")}</title>
        <style>
          @page { size: A4; margin: 18mm; }
          body { margin:0; font-family: Arial, sans-serif; color:#0f172a; background:#ffffff; }
          .card { border:1px solid #e2e8f0; border-radius:24px; overflow:hidden; }
          .header { background:linear-gradient(135deg,#0f172a,#1e293b); color:#fff; padding:28px; }
          .body { padding:28px; }
          .meta { display:grid; grid-template-columns:1fr 1fr; gap:16px; margin-top:18px; }
          .box { border:1px solid #e2e8f0; border-radius:18px; background:#f8fafc; padding:18px; }
          table { width:100%; border-collapse:collapse; }
          td { font-size:14px; }
          .section { margin-top:20px; }
        </style>
      </head>
      <body>
        <div class="card">
          <div class="header">
            <div style="font-size:12px;letter-spacing:.18em;text-transform:uppercase;opacity:.8;">LMS Fee Voucher</div>
            <h1 style="margin:8px 0 0;font-size:28px;line-height:1.2;">${safe(voucher.voucher_no || "Voucher")}</h1>
          </div>
          <div class="body">
            <div class="meta">
              <div class="box"><div style="color:#64748b;font-size:12px;text-transform:uppercase;letter-spacing:.18em;">Student</div><div style="margin-top:8px;font-weight:700;">${safe(voucher.student_name || "")}</div></div>
              <div class="box"><div style="color:#64748b;font-size:12px;text-transform:uppercase;letter-spacing:.18em;">Parent</div><div style="margin-top:8px;font-weight:700;">${safe(voucher.parent_name || "Not provided")}</div></div>
              <div class="box"><div style="color:#64748b;font-size:12px;text-transform:uppercase;letter-spacing:.18em;">Bank Name</div><div style="margin-top:8px;font-weight:700;">${safe(bankName)}</div></div>
              <div class="box"><div style="color:#64748b;font-size:12px;text-transform:uppercase;letter-spacing:.18em;">Due Date</div><div style="margin-top:8px;font-weight:700;">${safe(formatDate(voucher.due_date))}</div></div>
            </div>

            <div class="section box">
              <table>
                ${feeRows}
              </table>
            </div>

            <div class="section box">
              <div style="color:#64748b;font-size:12px;text-transform:uppercase;letter-spacing:.18em;">Payment Instructions</div>
              <p style="margin:12px 0 0;white-space:pre-line;line-height:1.7;">${safe(voucher.payment_instructions || "No payment instructions were added for this voucher.")}</p>
            </div>

            <div class="section box">
              <div style="color:#64748b;font-size:12px;text-transform:uppercase;letter-spacing:.18em;">Payment Method Details</div>
              <table style="margin-top:10px;">
                <tr><td style="padding:6px 0;color:#64748b;">Method</td><td style="padding:6px 0;text-align:right;font-weight:700;">${safe(paymentMethodName)}</td></tr>
                <tr><td style="padding:6px 0;color:#64748b;">Bank Name</td><td style="padding:6px 0;text-align:right;font-weight:700;">${safe(voucher.bank_name || paymentMethod.bank_name || "-")}</td></tr>
                <tr><td style="padding:6px 0;color:#64748b;">Account Title</td><td style="padding:6px 0;text-align:right;font-weight:700;">${safe(voucher.account_title || paymentMethod.account_title || "-")}</td></tr>
                <tr><td style="padding:6px 0;color:#64748b;">Account Number</td><td style="padding:6px 0;text-align:right;font-weight:700;">${safe(voucher.account_number || paymentMethod.account_number || "-")}</td></tr>
                <tr><td style="padding:6px 0;color:#64748b;">IBAN</td><td style="padding:6px 0;text-align:right;font-weight:700;">${safe(voucher.iban || paymentMethod.iban || "-")}</td></tr>
                <tr><td style="padding:6px 0;color:#64748b;">Branch Code</td><td style="padding:6px 0;text-align:right;font-weight:700;">${safe(voucher.branch_code || paymentMethod.branch_code || "-")}</td></tr>
                <tr><td style="padding:6px 0;color:#64748b;">Instructions</td><td style="padding:6px 0;text-align:right;font-weight:700;">${safe(voucher.payment_method_instructions || voucher.payment_instructions || paymentMethod.instructions || "-")}</td></tr>
              </table>
            </div>
          </div>
        </div>
      </body>
    </html>
  `;
}

async function downloadVoucherPdf(voucher) {
  const detail = voucher?.id ? await fetchVoucherDetails(voucher.id) : null;
  const normalized = normalizeVoucherForPdf(detail || voucher);
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 40;
  let y = margin;

  const regularFeeAmount = Number(normalized?.regular_fee_amount || 0);
  const otherFeeAmount = Number(normalized?.admission_fee_amount || 0);
  const subtotalAmount = Number(normalized?.subtotal_amount || regularFeeAmount + otherFeeAmount);
  const discountPercent = Number(normalized?.discount_percent || 0);
  const discountAmount = Number(normalized?.discount_amount || 0);
  const totalAmount = Number(normalized?.total_amount || subtotalAmount - discountAmount);
  const paymentMethod = normalized?.payment_method_details || {};
  const paymentMethodName = getDisplayPaymentMethod(normalized);
  const rows = [
    ["Voucher No", normalized?.voucher_no],
    ["Student", normalized?.student_name],
    ["Parent", normalized?.parent_name || "Not provided"],
    ["Class", normalized?.class_level || "-"],
    ["Due Date", formatDate(normalized?.due_date)],
    ["Regular Fee", regularFeeAmount > 0 ? formatMoney(regularFeeAmount) : "0"],
    ["Other Fee", otherFeeAmount > 0 ? formatMoney(otherFeeAmount) : "0"],
    ["Subtotal", formatMoney(subtotalAmount)],
    ["Discount on Regular Fee", `${discountPercent}% (${formatMoney(discountAmount)})`],
    ["Total Payable", formatMoney(totalAmount)],
    ["Payment Method", paymentMethodName],
    ["Bank Name", voucher?.bank_name || paymentMethod.bank_name || "-"],
    ["Account Title", voucher?.account_title || paymentMethod.account_title || "-"],
    ["Account Number", voucher?.account_number || paymentMethod.account_number || "-"],
    ["IBAN", voucher?.iban || paymentMethod.iban || "-"],
    ["Branch Code", voucher?.branch_code || paymentMethod.branch_code || "-"],
    ["Instructions", voucher?.payment_method_instructions || voucher?.payment_instructions || paymentMethod.instructions || "-"],
  ];

  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text("LMS Fee Voucher", margin, y);
  y += 28;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(12);

  rows.forEach(([label, value]) => {
    const line = `${label}: ${String(value || "-")}`;
    const wrapped = doc.splitTextToSize(line, pageWidth - margin * 2);
    if (y + wrapped.length * 16 > 800) {
      doc.addPage();
      y = margin;
    }
    doc.text(wrapped, margin, y);
    y += wrapped.length * 16;
  });

  const link = getPaymentSubmitLink(normalized);
  if (link) {
    y += 8;
    doc.setFont("helvetica", "bold");
    doc.text("Submit Payment", margin, y);
    y += 16;
    doc.setFont("helvetica", "normal");
    const wrappedLink = doc.splitTextToSize(link, pageWidth - margin * 2);
    doc.text(wrappedLink, margin, y);
  }

  doc.save(`${String(voucher?.voucher_no || "voucher").replace(/[^\w.-]+/g, "_")}.pdf`);
}

export default function FeeVoucherTable({ vouchers }) {
  const [selectedVoucher, setSelectedVoucher] = useState(null);
  const [toast, setToast] = useState("");

  async function copyVoucherLink(voucherId) {
    const voucher = vouchers.find((item) => item.id === voucherId);
  const link = voucher ? getPaymentSubmitLink(voucher) : "";
    if (!link) return;
    await navigator.clipboard.writeText(link);
    setToast("Voucher link copied.");
    window.clearTimeout(window.__voucherToastTimer);
    window.__voucherToastTimer = window.setTimeout(() => setToast(""), 2500);
  }

  if (!vouchers.length) {
    return (
      <section className="rounded-[1.75rem] border border-dashed border-slate-300 bg-white/85 p-10 text-center text-sm text-slate-500 shadow-[0_18px_60px_-36px_rgba(15,23,42,0.18)]">
        No fee vouchers match the current filters.
      </section>
    );
  }

  return (
    <>
      {toast ? (
        <div className="fixed right-6 top-6 z-[80] rounded-2xl border border-sky-200 bg-white px-4 py-3 text-sm font-semibold text-sky-700 shadow-[0_18px_60px_-36px_rgba(15,23,42,0.28)]">
          {toast}
        </div>
      ) : null}
      <section className="space-y-4">
        <div className="hidden overflow-hidden rounded-[1.75rem] border border-white/70 bg-white/90 shadow-[0_20px_70px_-36px_rgba(15,23,42,0.25)] lg:block">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50/80">
                <tr className="text-left text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                  <th className="px-6 py-4">Voucher</th>
                  <th className="px-6 py-4">Student</th>
                  <th className="px-6 py-4">Amount</th>
                  <th className="px-6 py-4">Due date</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {vouchers.map((voucher, index) => (
                  (() => {
                    const displayStatus = getDisplayStatus(voucher);
                    return (
                  <motion.tr
                    key={voucher.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.18, delay: index * 0.02 }}
                  >
                    <td className="px-6 py-5">
                      <p className="font-semibold text-slate-950">{voucher.voucher_no}</p>
                      <p className="mt-1 text-sm text-slate-500">{getDisplayBankName(voucher)}</p>
                    </td>
                    <td className="px-6 py-5">
                      <p className="font-semibold text-slate-950">{voucher.student_name}</p>
                      <p className="mt-1 text-sm text-slate-500">
                        {voucher.parent_name || "Parent pending"}
                      </p>
                    </td>
                    <td className="px-6 py-5 font-semibold text-slate-900">
                      {formatMoney(voucher.amount)}
                    </td>
                    <td className="px-6 py-5 text-sm text-slate-600">
                      {formatDate(voucher.due_date)}
                    </td>
                    <td className="px-6 py-5">
                      <span
                        className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${
                          STATUS_STYLES[displayStatus] || "bg-slate-100 text-slate-700"
                        }`}
                      >
                        {formatStatus(displayStatus)}
                      </span>
                    </td>
                    <td className="px-6 py-5">
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => setSelectedVoucher(voucher)}
                          className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
                        >
                          View voucher
                        </button>
                        <button
                          type="button"
                          onClick={() => copyVoucherLink(voucher.id)}
                          className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
                        >
                          Copy voucher link
                        </button>
                        <button
                          type="button"
                          onClick={() => downloadVoucherPdf(voucher)}
                          className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-100"
                        >
                          Download PDF
                        </button>
                      </div>
                    </td>
                  </motion.tr>
                    );
                  })()
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="grid gap-4 lg:hidden">
          {vouchers.map((voucher, index) => (
            (() => {
              const displayStatus = getDisplayStatus(voucher);
              return (
            <motion.article
              key={voucher.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.18, delay: index * 0.02 }}
              className="rounded-[1.5rem] border border-white/70 bg-white/90 p-5 shadow-[0_18px_60px_-36px_rgba(15,23,42,0.22)]"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-lg font-semibold text-slate-950">{voucher.voucher_no}</p>
                  <p className="mt-1 text-sm text-slate-600">{voucher.student_name}</p>
                  <p className="mt-1 text-sm text-slate-500">
                    {getDisplayBankName(voucher)}
                  </p>
                </div>
                <span
                  className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${
                    STATUS_STYLES[displayStatus] || "bg-slate-100 text-slate-700"
                  }`}
                >
                  {formatStatus(displayStatus)}
                </span>
              </div>

              <div className="mt-4 grid gap-2 text-sm text-slate-600">
                <p>Regular Fee: {formatMoney(voucher.regular_fee_amount)}</p>
                <p>Other Fee: {formatMoney(voucher.admission_fee_amount)}</p>
                <p>Subtotal: {formatMoney(voucher.subtotal_amount)}</p>
                <p>Discount on Regular Fee: {Number(voucher.discount_percent || 0)}% ({formatMoney(voucher.discount_amount)})</p>
                <p>Total Payable: {formatMoney(voucher.total_amount || voucher.amount)}</p>
                <p>Due date: {formatDate(voucher.due_date)}</p>
                <p>Method: {getDisplayPaymentMethod(voucher)}</p>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedVoucher(voucher)}
                  className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
                >
                  View voucher
                </button>
                <button
                  type="button"
                  onClick={() => copyVoucherLink(voucher.id)}
                  className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
                >
                  Copy voucher link
                </button>
                <button
                  type="button"
                  onClick={() => downloadVoucherPdf(voucher)}
                  className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-100"
                >
                  Download PDF
                </button>
              </div>
            </motion.article>
              );
            })()
          ))}
        </div>
      </section>

      <FeeVoucherPreviewModal
        voucher={selectedVoucher}
        onClose={() => setSelectedVoucher(null)}
      />
    </>
  );
}
