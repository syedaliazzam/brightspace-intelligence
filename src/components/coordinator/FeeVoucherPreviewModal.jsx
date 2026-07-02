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
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-hidden bg-[#063F32]/45 px-4 pt-24 pb-10">
          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 18 }}
            transition={{ duration: 0.2 }}
            className="w-full max-w-2xl max-h-[calc(100vh-6.5rem)] overflow-y-auto rounded-[2rem] border border-[#2D8A6A]/15 bg-[#FAF7F0] p-6 shadow-[0_24px_80px_-36px_rgba(13,59,46,0.24)] sm:p-8"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.24em] text-[#C9A227]">
                  Voucher preview
                </p>
                <h2 className="mt-2 text-2xl font-semibold tracking-tight text-[#063F32]">
                  {voucher.voucher_no}
                </h2>
              </div>

              <button
                type="button"
                onClick={onClose}
                className="rounded-xl border border-[#2D8A6A]/20 bg-white px-3 py-2 text-sm font-semibold text-[#063F32] transition hover:bg-[#F1EADC]"
              >
                Close
              </button>
            </div>

            <div className="mt-6 grid gap-4 rounded-[1.5rem] border border-[#2D8A6A]/15 bg-white/90 p-5 sm:grid-cols-2">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#245C4F]">
                  Student
                </p>
                <p className="mt-2 font-semibold text-[#063F32]">{voucher.student_name}</p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#245C4F]">
                  Parent
                </p>
                <p className="mt-2 font-semibold text-[#063F32]">
                  {voucher.parent_name || "Not provided"}
                </p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#245C4F]">
                  Amount
                </p>
                <p className="mt-2 font-semibold text-[#063F32]">PKR {voucher.amount}</p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#245C4F]">
                  Due date
                </p>
                <p className="mt-2 font-semibold text-[#063F32]">{formatDate(voucher.due_date)}</p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#245C4F]">
                  Bank name
                </p>
                <p className="mt-2 font-semibold text-[#063F32]">{bankName}</p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#245C4F]">
                  Contact
                </p>
                <p className="mt-2 font-semibold text-[#063F32]">
                  {voucher.phone || voucher.email || "Not provided"}
                </p>
              </div>
            </div>

            <div className="mt-5 rounded-[1.5rem] border border-[#2D8A6A]/15 bg-[#FAF7F0] p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#245C4F]">
                Payment instructions
              </p>
              <p className="mt-3 whitespace-pre-line text-sm leading-7 text-[#245C4F]">
                {voucher.payment_instructions || "No payment instructions were added for this voucher."}
              </p>
            </div>
          </motion.div>
        </div>
      ) : null}
    </AnimatePresence>
  );
}
