"use client";

import { AnimatePresence, motion } from "framer-motion";

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

export default function FeeVoucherPreviewModal({ voucher, onClose }) {
  const bankName =
    voucher?.bank_name ||
    voucher?.payment_method_details?.bank_name ||
    voucher?.payment_method ||
    "Payment method unavailable";

  return (
    <AnimatePresence>
      {voucher ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 px-4 py-8">
          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 18 }}
            transition={{ duration: 0.2 }}
            className="w-full max-w-2xl rounded-[2rem] border border-white/70 bg-white p-6 shadow-[0_24px_80px_-36px_rgba(15,23,42,0.32)] sm:p-8"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.24em] text-sky-700">
                  Voucher preview
                </p>
                <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">
                  {voucher.voucher_no}
                </h2>
              </div>

              <button
                type="button"
                onClick={onClose}
                className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
              >
                Close
              </button>
            </div>

            <div className="mt-6 grid gap-4 rounded-[1.5rem] border border-slate-200 bg-slate-50 p-5 sm:grid-cols-2">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                  Student
                </p>
                <p className="mt-2 font-semibold text-slate-950">{voucher.student_name}</p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                  Parent
                </p>
                <p className="mt-2 font-semibold text-slate-950">
                  {voucher.parent_name || "Not provided"}
                </p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                  Amount
                </p>
                <p className="mt-2 font-semibold text-slate-950">PKR {voucher.amount}</p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                  Due date
                </p>
                <p className="mt-2 font-semibold text-slate-950">{formatDate(voucher.due_date)}</p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                  Bank name
                </p>
                <p className="mt-2 font-semibold text-slate-950">{bankName}</p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                  Contact
                </p>
                <p className="mt-2 font-semibold text-slate-950">
                  {voucher.phone || voucher.email || "Not provided"}
                </p>
              </div>
            </div>

            <div className="mt-5 rounded-[1.5rem] border border-slate-200 bg-white p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                Payment instructions
              </p>
              <p className="mt-3 whitespace-pre-line text-sm leading-7 text-slate-700">
                {voucher.payment_instructions || "No payment instructions were added for this voucher."}
              </p>
            </div>
          </motion.div>
        </div>
      ) : null}
    </AnimatePresence>
  );
}
