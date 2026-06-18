"use client";

import { AnimatePresence, motion } from "framer-motion";

function isPdf(url) {
  return String(url || "").toLowerCase().includes(".pdf");
}

export default function PaymentProofPreview({ item, onClose, onApprove, onReject }) {
  return (
    <AnimatePresence>
      {item ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 px-4 py-8">
          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 18 }}
            transition={{ duration: 0.2 }}
            className="w-full max-w-4xl rounded-[2rem] border border-white/70 bg-white p-6 shadow-[0_24px_80px_-36px_rgba(15,23,42,0.32)] sm:p-8"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.24em] text-sky-700">
                  Payment proof
                </p>
                <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">
                  {item.voucher_no}
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
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Student</p>
                <p className="mt-2 font-semibold text-slate-950">{item.student_name}</p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Transaction ID</p>
                <p className="mt-2 font-semibold text-slate-950">{item.transaction_id}</p>
              </div>
            </div>

            <div className="mt-5 overflow-hidden rounded-[1.5rem] border border-slate-200 bg-white">
              {item.proof_file_url ? (
                isPdf(item.proof_file_url) ? (
                  <iframe
                    title="Payment proof PDF"
                    src={item.proof_file_url}
                    className="h-[70vh] w-full"
                  />
                ) : (
                  <img
                    src={item.proof_file_url}
                    alt="Payment proof"
                    className="max-h-[70vh] w-full object-contain bg-slate-50"
                  />
                )
              ) : (
                <div className="p-10 text-center text-sm text-slate-500">
                  Preview unavailable for this payment proof.
                </div>
              )}
            </div>

            {String(item?.status || "").toLowerCase() === "pending" ? (
              <div className="mt-5 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => onApprove?.(item)}
                  className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-700 transition hover:bg-emerald-100"
                >
                  Approve payment
                </button>
                <button
                  type="button"
                  onClick={() => onReject?.(item)}
                  className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2 text-sm font-semibold text-rose-700 transition hover:bg-rose-100"
                >
                  Reject payment
                </button>
              </div>
            ) : null}
          </motion.div>
        </div>
      ) : null}
    </AnimatePresence>
  );
}
