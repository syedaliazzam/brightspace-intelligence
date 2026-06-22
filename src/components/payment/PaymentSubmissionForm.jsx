"use client";

import { useState } from "react";

const LOCKED_STATUSES = new Set(["submitted", "verified"]);

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

  async function handleSubmit(event) {
    event.preventDefault();
    const formElement = event.currentTarget;
    setPending(true);
    setMessage("");

    try {
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
    } catch (error) {
      setTone("error");
      setMessage(error instanceof Error ? error.message : "Payment submission failed.");
    } finally {
      setPending(false);
    }
  }

  const submissionLocked = LOCKED_STATUSES.has(String(voucher.status || "").toLowerCase());

  return (
    <div className="grid gap-6 lg:grid-cols-[0.92fr_1.08fr]">
      <section className="rounded-[2rem] border border-white/70 bg-white/90 p-6 shadow-[0_24px_80px_-36px_rgba(15,23,42,0.22)] sm:p-8">
        <p className="text-sm font-semibold uppercase tracking-[0.24em] text-sky-700">
          Voucher details
        </p>
        <div className="mt-6 space-y-4 text-sm text-slate-600">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Student</p>
            <p className="mt-2 text-base font-semibold text-slate-950">{voucher.student_name}</p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Parent</p>
            <p className="mt-2 text-base font-semibold text-slate-950">
              {voucher.parent_name || "Not provided"}
            </p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Amount</p>
            <p className="mt-2 text-base font-semibold text-slate-950">PKR {voucher.amount}</p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Due date</p>
            <p className="mt-2 text-base font-semibold text-slate-950">{formatDate(voucher.due_date)}</p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Payment method</p>
            <p className="mt-2 text-base font-semibold text-slate-950">{voucher.payment_method}</p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Instructions</p>
            <p className="mt-2 whitespace-pre-line leading-7 text-slate-700">
              {voucher.payment_instructions || "No payment instructions were provided."}
            </p>
          </div>
        </div>
      </section>

      <section className="rounded-[2rem] border border-white/70 bg-white/90 p-6 shadow-[0_24px_80px_-36px_rgba(15,23,42,0.22)] sm:p-8">
        <p className="text-sm font-semibold uppercase tracking-[0.24em] text-sky-700">
          Submit payment
        </p>
        <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">
          Share payment proof
        </h2>

        {submissionLocked ? (
          <div className="mt-6 rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-800">
            This voucher is currently marked as {voucher.status}. New submissions are temporarily disabled.
          </div>
        ) : null}

        <form className="mt-6 grid gap-4" onSubmit={handleSubmit}>
          <label className="block">
            <span className="mb-2 block text-sm font-medium text-slate-700">Payer name</span>
            <input
              type="text"
              name="payerName"
              disabled={submissionLocked || pending}
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-sky-400 focus:bg-white focus:ring-4 focus:ring-sky-100 disabled:opacity-60"
              placeholder="Enter payer name"
              required
            />
          </label>

          <label className="block">
            <span className="mb-2 block text-sm font-medium text-slate-700">Transaction ID</span>
            <input
              type="text"
              name="transactionId"
              disabled={submissionLocked || pending}
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-sky-400 focus:bg-white focus:ring-4 focus:ring-sky-100 disabled:opacity-60"
              placeholder="Bank reference or wallet transaction ID"
              required
            />
          </label>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="mb-2 block text-sm font-medium text-slate-700">Paid amount</span>
              <input
                type="number"
                min="1"
                step="0.01"
                name="paidAmount"
                disabled={submissionLocked || pending}
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-sky-400 focus:bg-white focus:ring-4 focus:ring-sky-100 disabled:opacity-60"
                placeholder="5000"
                required
              />
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-medium text-slate-700">Paid at</span>
              <input
                type="datetime-local"
                name="paidAt"
                disabled={submissionLocked || pending}
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-sky-400 focus:bg-white focus:ring-4 focus:ring-sky-100 disabled:opacity-60"
                required
              />
            </label>
          </div>

          <label className="block">
            <span className="mb-2 block text-sm font-medium text-slate-700">Payment proof file</span>
            <input
              type="file"
              name="proofFile"
              accept="image/*,.pdf"
              disabled={submissionLocked || pending}
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-950 outline-none transition file:mr-4 file:rounded-xl file:border-0 file:bg-slate-950 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-white hover:file:bg-slate-800 focus:border-sky-400 focus:bg-white focus:ring-4 focus:ring-sky-100 disabled:opacity-60"
              required
            />
          </label>

          {message ? (
            <p
              className={`rounded-2xl px-4 py-3 text-sm ${
                tone === "success"
                  ? "bg-emerald-50 text-emerald-700"
                  : "bg-rose-50 text-rose-700"
              }`}
            >
              {message}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={submissionLocked || pending}
            className="inline-flex items-center justify-center rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {pending ? "Submitting..." : "Submit payment proof"}
          </button>
        </form>
      </section>
    </div>
  );
}
