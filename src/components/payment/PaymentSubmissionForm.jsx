"use client";

import { useEffect, useMemo, useState } from "react";
import { LeafSpinnerInline } from "@/components/shared/AshShajrahLoaders";

const LOCKED_STATUSES = new Set(["submitted", "verified"]);
const NAME_PATTERN = "^[A-Za-zÀ-ÿ'’.-]{2,}(?:\\s+[A-Za-zÀ-ÿ'’.-]{2,})+$";
const PHONE_PATTERN = "^(?:\\+92|0)?[0-9]{10,12}$";
const TRANSACTION_PATTERN = "^[A-Za-z0-9_-]{3,150}$";

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

export default function PaymentSubmissionForm({ voucher }) {
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const [tone, setTone] = useState("neutral");
  const [proofPreview, setProofPreview] = useState("");

  const paymentMethods = useMemo(
    () => voucher.available_payment_methods || [],
    [voucher.available_payment_methods]
  );

  useEffect(() => {
    return () => {
      if (proofPreview?.startsWith("blob:")) {
        URL.revokeObjectURL(proofPreview);
      }
    };
  }, [proofPreview]);

  async function handleSubmit(event) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const proofInput = formElement.elements.namedItem("proofFile");

    setPending(true);
    setMessage("");

    try {
      if (!(proofInput instanceof HTMLInputElement) || !proofInput.files?.length) {
        throw new Error("Payment proof file is required.");
      }

      const formData = new FormData(formElement);
      formData.set("voucherNo", voucher.voucher_no);

      const response = await fetch("/api/payment/submit", {
        method: "POST",
        body: formData,
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.message || "Payment submission failed.");
      }

      setTone("success");
      setMessage("Payment proof submitted successfully. The coordinator will review it shortly.");
      formElement.reset();
      if (proofPreview?.startsWith("blob:")) {
        URL.revokeObjectURL(proofPreview);
      }
      setProofPreview("");
    } catch (error) {
      setTone("error");
      setMessage(error instanceof Error ? error.message : "Payment submission failed.");
    } finally {
      setPending(false);
    }
  }

  const submissionLocked = LOCKED_STATUSES.has(String(voucher.status || "").toLowerCase());

  function handleProofChange(event) {
    const file = event.target.files?.[0];
    if (!file) {
      if (proofPreview?.startsWith("blob:")) {
        URL.revokeObjectURL(proofPreview);
      }
      setProofPreview("");
      return;
    }

    if (proofPreview?.startsWith("blob:")) {
      URL.revokeObjectURL(proofPreview);
    }
    setProofPreview(URL.createObjectURL(file));
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[0.92fr_1.08fr]">
      <section className="rounded-[2rem] border border-[#2D8A6A]/15 bg-[linear-gradient(180deg,rgba(255,255,255,0.94),rgba(250,247,240,0.98))] p-6 shadow-[0_24px_80px_-36px_rgba(13,59,46,0.18)] sm:p-8">
        <p className="text-sm font-semibold uppercase tracking-[0.24em] text-[#C9A227]">
          Voucher details
        </p>
        <div className="mt-6 space-y-4 text-sm text-[#245C4F]">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#245C4F]">Student</p>
            <p className="mt-2 text-base font-semibold text-[#063F32]">{voucher.student_name}</p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#245C4F]">Parent</p>
            <p className="mt-2 text-base font-semibold text-[#063F32]">
              {voucher.parent_name || "Not provided"}
            </p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#245C4F]">Class level</p>
            <p className="mt-2 text-base font-semibold text-[#063F32]">
              {voucher.class_level || "Not provided"}
            </p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#245C4F]">Amount</p>
            <p className="mt-2 text-base font-semibold text-[#063F32]">
              PKR {Number(voucher.total_amount || voucher.amount || 0).toFixed(2)}
            </p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#245C4F]">Due date</p>
            <p className="mt-2 text-base font-semibold text-[#063F32]">{formatDate(voucher.due_date)}</p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#245C4F]">Payment method</p>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              {paymentMethods.map((method) => (
                <div
                  key={method.id}
                  className="rounded-2xl border border-[#0D5C48] bg-[#EAF6EF] p-4 text-sm text-[#245C4F] shadow-[0_12px_32px_-22px_rgba(13,92,72,0.35)]"
                >
                  <p className="text-base font-semibold text-[#063F32]">{method.name}</p>
                  {method.bank_name ? (
                    <p className="mt-1">
                      <span className="font-semibold text-[#063F32]">Bank:</span> {method.bank_name}
                    </p>
                  ) : null}
                  {method.account_title ? (
                    <p className="mt-1">
                      <span className="font-semibold text-[#063F32]">Account title:</span> {method.account_title}
                    </p>
                  ) : null}
                  {method.account_number ? (
                    <p className="mt-1">
                      <span className="font-semibold text-[#063F32]">Account number:</span> {method.account_number}
                    </p>
                  ) : null}
                  {method.iban ? (
                    <p className="mt-1">
                      <span className="font-semibold text-[#063F32]">IBAN:</span> {method.iban}
                    </p>
                  ) : null}
                  {method.branch_code ? (
                    <p className="mt-1">
                      <span className="font-semibold text-[#063F32]">Branch code:</span> {method.branch_code}
                    </p>
                  ) : null}
                  {method.instructions ? (
                    <p className="mt-2 whitespace-pre-line">
                      <span className="font-semibold text-[#063F32]">Instructions:</span> {method.instructions}
                    </p>
                  ) : null}
                </div>
              ))}
            </div>
            {!paymentMethods.length ? (
              <p className="mt-3 text-sm text-[#245C4F]">No payment methods provided.</p>
            ) : null}
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#245C4F]">Instructions</p>
            <p className="mt-2 whitespace-pre-line leading-7 text-[#245C4F]">
              {voucher.payment_instructions || "No payment instructions were provided."}
            </p>
          </div>
        </div>
      </section>

      <section className="rounded-[2rem] border border-[#2D8A6A]/15 bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(250,247,240,0.98))] p-6 shadow-[0_24px_80px_-36px_rgba(13,59,46,0.18)] sm:p-8">
        <p className="text-sm font-semibold uppercase tracking-[0.24em] text-[#C9A227]">
          Submit payment
        </p>
        <h2 className="mt-2 text-2xl font-semibold tracking-tight text-[#063F32]">
          Share payment proof
        </h2>

        {submissionLocked ? (
          <div className="mt-6 rounded-2xl border border-[#E4C766]/40 bg-[#FFF5D6] px-4 py-3 text-sm text-[#8A6B00]">
            This voucher is currently marked as {voucher.status}. New submissions are temporarily disabled.
          </div>
        ) : null}

        <form className="mt-6 grid gap-4" onSubmit={handleSubmit}>
          <label className="block">
            <span className="mb-2 block text-sm font-medium text-[#245C4F]">Payer name</span>
            <input
              type="text"
              name="payerName"
              disabled={submissionLocked || pending}
              pattern={NAME_PATTERN}
              title="Please enter a valid name."
              className="w-full rounded-2xl border border-[#2D8A6A]/20 bg-[#FAF7F0] px-4 py-3 text-sm text-[#063F32] outline-none transition placeholder:text-[#7A938B] focus:border-[#2D8A6A] focus:bg-white focus:ring-4 focus:ring-[#FFF5D6] disabled:opacity-60"
              placeholder="Enter payer name"
              required
            />
          </label>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="mb-2 block text-sm font-medium text-[#245C4F]">Payer email</span>
              <input
                type="email"
                name="payerEmail"
                disabled={submissionLocked || pending}
                className="w-full rounded-2xl border border-[#2D8A6A]/20 bg-[#FAF7F0] px-4 py-3 text-sm text-[#063F32] outline-none transition placeholder:text-[#7A938B] focus:border-[#2D8A6A] focus:bg-white focus:ring-4 focus:ring-[#FFF5D6] disabled:opacity-60"
                placeholder="payer@example.com"
                required
              />
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-medium text-[#245C4F]">Payer phone</span>
              <input
                type="tel"
                name="payerPhone"
                disabled={submissionLocked || pending}
                pattern={PHONE_PATTERN}
                title="Enter a valid phone number."
                className="w-full rounded-2xl border border-[#2D8A6A]/20 bg-[#FAF7F0] px-4 py-3 text-sm text-[#063F32] outline-none transition placeholder:text-[#7A938B] focus:border-[#2D8A6A] focus:bg-white focus:ring-4 focus:ring-[#FFF5D6] disabled:opacity-60"
                placeholder="03xx-xxxxxxx"
                required
              />
            </label>
          </div>

          <label className="block">
            <span className="mb-2 block text-sm font-medium text-[#245C4F]">Transaction ID</span>
            <input
              type="text"
              name="transactionId"
              disabled={submissionLocked || pending}
              pattern={TRANSACTION_PATTERN}
              title="Enter a valid transaction ID."
              className="w-full rounded-2xl border border-[#2D8A6A]/20 bg-[#FAF7F0] px-4 py-3 text-sm text-[#063F32] outline-none transition placeholder:text-[#7A938B] focus:border-[#2D8A6A] focus:bg-white focus:ring-4 focus:ring-[#FFF5D6] disabled:opacity-60"
              placeholder="Bank reference or wallet transaction ID"
              required
            />
          </label>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="mb-2 block text-sm font-medium text-[#245C4F]">Paid amount</span>
              <input
                type="number"
                min="1"
                step="0.01"
                name="paidAmount"
                disabled={submissionLocked || pending}
                inputMode="decimal"
                className="w-full rounded-2xl border border-[#2D8A6A]/20 bg-[#FAF7F0] px-4 py-3 text-sm text-[#063F32] outline-none transition placeholder:text-[#7A938B] focus:border-[#2D8A6A] focus:bg-white focus:ring-4 focus:ring-[#FFF5D6] disabled:opacity-60"
                placeholder="5000"
                required
              />
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-medium text-[#245C4F]">Paid at</span>
              <input
                type="datetime-local"
                name="paidAt"
                disabled={submissionLocked || pending}
                className="w-full rounded-2xl border border-[#2D8A6A]/20 bg-[#FAF7F0] px-4 py-3 text-sm text-[#063F32] outline-none transition focus:border-[#2D8A6A] focus:bg-white focus:ring-4 focus:ring-[#FFF5D6] disabled:opacity-60"
                required
              />
            </label>
          </div>

          <label className="block">
            <span className="mb-2 block text-sm font-medium text-[#245C4F]">Payment proof file</span>
            <input
              type="file"
              name="proofFile"
              accept="image/*,.pdf"
              onChange={handleProofChange}
              disabled={submissionLocked || pending}
              className="w-full rounded-2xl border border-[#2D8A6A]/20 bg-[#FAF7F0] px-4 py-3 text-sm text-[#063F32] outline-none transition file:mr-4 file:rounded-xl file:border-0 file:bg-[#0D5C48] file:px-3 file:py-2 file:text-sm file:font-semibold file:text-[#FAF7F0] hover:file:bg-[#063F32] focus:border-[#2D8A6A] focus:bg-white focus:ring-4 focus:ring-[#FFF5D6] disabled:opacity-60"
              required
            />
          </label>

          {proofPreview ? (
            <a
              href={proofPreview}
              target="_blank"
              rel="noreferrer"
              className="block overflow-hidden rounded-2xl border border-[#2D8A6A]/15 bg-white"
            >
              {String(voucher.proof_file_name || "").toLowerCase().includes(".pdf") ? (
                <div className="p-6 text-center text-sm font-semibold text-[#0D5C48]">
                  Open selected proof
                </div>
              ) : (
                <img
                  src={proofPreview}
                  alt="Selected proof preview"
                  className="h-52 w-full object-contain bg-[#FAF7F0] p-3"
                />
              )}
            </a>
          ) : null}

          {message ? (
            <p
              className={`rounded-2xl px-4 py-3 text-sm ${
                tone === "success"
                  ? "border border-[#2D8A6A]/20 bg-[#EAF6EF] text-[#0D5C48]"
                  : "border border-rose-200 bg-rose-50 text-rose-700"
              }`}
            >
              {message}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={submissionLocked || pending}
            className="inline-flex items-center justify-center rounded-2xl bg-[#0D5C48] px-4 py-3 text-sm font-semibold text-[#FAF7F0] transition hover:bg-[#063F32] disabled:cursor-not-allowed disabled:opacity-70"
          >
            {pending ? (
              <span className="inline-flex items-center gap-2">
                <LeafSpinnerInline />
                Submitting...
              </span>
            ) : (
              "Submit payment proof"
            )}
          </button>
        </form>
      </section>
    </div>
  );
}
