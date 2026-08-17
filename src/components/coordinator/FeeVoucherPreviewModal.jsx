"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useMemo, useState } from "react";
import ClientPortal from "@/components/shared/ClientPortal";
import { LeafSpinnerInline } from "@/components/shared/AshShajrahLoaders";

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
  const [approveOpen, setApproveOpen] = useState(false);
  const [approveAmount, setApproveAmount] = useState("");
  const [approveProofFile, setApproveProofFile] = useState(null);
  const [approvePending, setApprovePending] = useState(false);
  const [approveError, setApproveError] = useState("");
  const bankName =
    voucher?.bank_name ||
    voucher?.payment_method_details?.bank_name ||
    voucher?.payment_method ||
    "Payment method unavailable";
  const submissionStatus = String(voucher?.payment_submission_status || "").toLowerCase();
  const canApproveMonthlyPayment = Boolean(voucher?.fee_submission_id) && submissionStatus === "pending";

  const proofLabel = useMemo(() => {
    if (approveProofFile?.name) return approveProofFile.name;
    if (voucher?.proof_file_path) return "Existing proof available";
    return "No file chosen";
  }, [approveProofFile?.name, voucher?.proof_file_path]);

  const proofPreview = useMemo(() => {
    if (!approveProofFile) return null;
    const isImage = approveProofFile.type.startsWith("image/");
    const previewUrl = isImage ? URL.createObjectURL(approveProofFile) : null;
    return { name: approveProofFile.name, isImage, previewUrl };
  }, [approveProofFile]);

  async function submitApprove(event) {
    event.preventDefault();
    if (!voucher?.fee_submission_id) return;
    if (!approveProofFile && !voucher?.proof_file_path) {
      setApproveError("Payment proof is required.");
      return;
    }

    setApprovePending(true);
    setApproveError("");

    try {
      const formData = new FormData();
      formData.append("action", "approve");
      formData.append("paidAmount", String(approveAmount || voucher?.paid_amount || voucher?.total_amount || voucher?.amount || 0));
      if (approveProofFile) {
        formData.append("proofFile", approveProofFile);
      }

      const response = await fetch(`/api/coordinator/payments/${encodeURIComponent(voucher.fee_submission_id)}/verify`, {
        method: "POST",
        body: formData,
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data?.message || "Unable to approve payment.");
      }

      setApproveOpen(false);
      onClose?.();
    } catch (error) {
      setApproveError(error instanceof Error ? error.message : "Unable to approve payment.");
    } finally {
      setApprovePending(false);
    }
  }

  return (
    <AnimatePresence>
      {voucher ? (
        <ClientPortal targetId="coordinator-page-portal-root">
        <div className="absolute inset-x-0 top-0 z-[9999] isolate flex min-h-full items-start justify-center overflow-visible bg-[#063F32]/45 px-4 pt-24 pb-10">
          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 18 }}
            transition={{ duration: 0.2 }}
            className="w-full max-w-2xl rounded-[2rem] border border-[#2D8A6A]/15 bg-[#FAF7F0] p-6 shadow-[0_24px_80px_-36px_rgba(13,59,46,0.24)] sm:p-8"
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

            <div className="mt-6 grid gap-4 rounded-[1.75rem] border border-[#2D8A6A]/15 bg-[linear-gradient(180deg,rgba(255,255,255,0.96)_0%,rgba(250,247,240,0.98)_100%)] p-5 shadow-[0_18px_60px_-36px_rgba(13,59,46,0.14)] sm:grid-cols-2">
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
                  Current pending due
                </p>
                <p className="mt-2 font-semibold text-[#063F32]">
                  PKR {Number(voucher.current_pending_due || voucher.total_amount || voucher.amount || 0).toLocaleString("en-PK")}
                </p>
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

            <div className="mt-5 overflow-hidden rounded-[1.5rem] border border-[#2D8A6A]/15 bg-white">
              <div className="overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                  <thead className="bg-[linear-gradient(180deg,#FAF7F0_0%,#F1EADC_100%)] text-xs uppercase tracking-[0.18em] text-[#0D5C48]">
                    <tr>
                      <th className="px-4 py-3">Voucher</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#F1EADC]">
                    <tr>
                      <td className="px-4 py-4 font-semibold text-[#063F32]">{voucher.voucher_no}</td>
                      <td className="px-4 py-4 text-[#245C4F]">
                        {voucher.payment_submission_status || "not_submitted"}
                      </td>
                      <td className="px-4 py-4">
                        {canApproveMonthlyPayment ? (
                          <button
                            type="button"
                            onClick={() => {
                              setApproveAmount(String(voucher.paid_amount || voucher.total_amount || voucher.amount || ""));
                              setApproveProofFile(null);
                              setApproveError("");
                              setApproveOpen(true);
                            }}
                            className="rounded-xl border border-[#2D8A6A]/20 bg-[#EAF6EF] px-3 py-2 text-xs font-semibold text-[#0D5C48] transition hover:bg-[#DFF1E7]"
                          >
                            Approve payment
                          </button>
                        ) : (
                          <span className="text-xs font-medium text-[#7A938B]">
                            {voucher?.fee_submission_id ? "No approval needed" : "No action available"}
                          </span>
                        )}
                      </td>
                    </tr>
                  </tbody>
                </table>
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

            {approveOpen ? (
              <div className="fixed inset-0 z-[10000] flex items-start justify-center bg-[#063F32]/45 px-4 pt-10 pb-10 backdrop-blur-sm">
                <div className="w-full max-w-2xl rounded-[2rem] border border-[#2D8A6A]/15 bg-[#FAF7F0] p-6 shadow-[0_24px_80px_-36px_rgba(13,59,46,0.24)] sm:p-8">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-sm font-semibold uppercase tracking-[0.24em] text-[#0D5C48]">Approve monthly payment</p>
                      <h3 className="mt-2 text-xl font-semibold text-[#063F32]">{voucher.voucher_no}</h3>
                    </div>
                    <button
                      type="button"
                      onClick={() => setApproveOpen(false)}
                      className="rounded-xl border border-[#2D8A6A]/20 bg-white px-3 py-2 text-sm font-semibold text-[#063F32]"
                    >
                      Close
                    </button>
                  </div>
                  <form className="mt-6 grid gap-4" onSubmit={submitApprove}>
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
                    <p className="mt-2 text-xs font-medium text-[#245C4F]">Selected file: {proofLabel}</p>
                    {proofPreview ? (
                      <div className="mt-3 rounded-2xl border border-[#2D8A6A]/15 bg-white p-3">
                        {proofPreview.isImage ? (
                          <img
                            src={proofPreview.previewUrl}
                            alt={proofPreview.name}
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
                        onClick={() => setApproveOpen(false)}
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
            ) : null}
          </motion.div>
        </div>
        </ClientPortal>
      ) : null}
    </AnimatePresence>
  );
}
