"use client";

import { motion } from "framer-motion";
import { useState } from "react";
import FeeVoucherPreviewModal from "@/components/coordinator/FeeVoucherPreviewModal";

const STATUS_STYLES = {
  unpaid: "bg-slate-100 text-slate-700",
  submitted: "bg-amber-50 text-amber-700",
  verified: "bg-emerald-50 text-emerald-700",
  rejected: "bg-rose-50 text-rose-700",
  expired: "bg-violet-50 text-violet-700",
};

function formatStatus(value) {
  const text = String(value || "");
  return text ? text[0].toUpperCase() + text.slice(1) : "Unknown";
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

export default function FeeVoucherTable({ vouchers }) {
  const [selectedVoucher, setSelectedVoucher] = useState(null);

  async function copyVoucherLink(voucherId) {
    const link = `${window.location.origin}/coordinator/fee-vouchers?voucher=${voucherId}`;
    await navigator.clipboard.writeText(link);
    window.alert("Voucher link copied.");
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
                  <motion.tr
                    key={voucher.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.18, delay: index * 0.02 }}
                  >
                    <td className="px-6 py-5">
                      <p className="font-semibold text-slate-950">{voucher.voucher_no}</p>
                      <p className="mt-1 text-sm text-slate-500">{voucher.payment_method}</p>
                    </td>
                    <td className="px-6 py-5">
                      <p className="font-semibold text-slate-950">{voucher.student_name}</p>
                      <p className="mt-1 text-sm text-slate-500">
                        {voucher.parent_name || "Parent pending"}
                      </p>
                    </td>
                    <td className="px-6 py-5 font-semibold text-slate-900">
                      PKR {voucher.amount}
                    </td>
                    <td className="px-6 py-5 text-sm text-slate-600">
                      {formatDate(voucher.due_date)}
                    </td>
                    <td className="px-6 py-5">
                      <span
                        className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${
                          STATUS_STYLES[voucher.status] || "bg-slate-100 text-slate-700"
                        }`}
                      >
                        {formatStatus(voucher.status)}
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
                          onClick={() => window.alert("PDF download will be added in a later feature.")}
                          className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-100"
                        >
                          Download PDF
                        </button>
                      </div>
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="grid gap-4 lg:hidden">
          {vouchers.map((voucher, index) => (
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
                    {voucher.parent_name || "Parent pending"}
                  </p>
                </div>
                <span
                  className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${
                    STATUS_STYLES[voucher.status] || "bg-slate-100 text-slate-700"
                  }`}
                >
                  {formatStatus(voucher.status)}
                </span>
              </div>

              <div className="mt-4 grid gap-2 text-sm text-slate-600">
                <p>Amount: PKR {voucher.amount}</p>
                <p>Due date: {formatDate(voucher.due_date)}</p>
                <p>Method: {voucher.payment_method}</p>
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
                  onClick={() => window.alert("PDF download will be added in a later feature.")}
                  className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-100"
                >
                  Download PDF
                </button>
              </div>
            </motion.article>
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
