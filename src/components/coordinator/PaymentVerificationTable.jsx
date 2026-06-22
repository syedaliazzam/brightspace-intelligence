"use client";

import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { useState } from "react";
import PaymentProofPreview from "@/components/coordinator/PaymentProofPreview";

const STATUS_STYLES = {
  submitted: "bg-amber-50 text-amber-700",
  verified: "bg-emerald-50 text-emerald-700",
  rejected: "bg-rose-50 text-rose-700",
};

function formatStatus(value) {
  const text = String(value || "");
  return text ? text[0].toUpperCase() + text.slice(1) : "Unknown";
}

function normalizeStatus(value) {
  return String(value || "").trim().toLowerCase();
}

function formatDate(value) {
  if (!value) {
    return "No date";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "Invalid date";
  }

  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

export default function PaymentVerificationTable({ items }) {
  const router = useRouter();
  const [pendingId, setPendingId] = useState("");
  const [selectedItem, setSelectedItem] = useState(null);

  function openProofPreview(item) {
    const previewItem = {
      ...item,
      proof_file_url:
        item.proof_file_url ||
        (item.proof_file_path
          ? `${process.env.NEXT_PUBLIC_SUPABASE_URL || ""}/storage/v1/object/public/payment_proofs/${String(item.proof_file_path).replace(/^payment_proofs\//, "")}`
          : ""),
    };

    setSelectedItem(previewItem);
  }

  async function verifyPayment(id, action) {
    const rejectionReason =
      action === "reject"
        ? window.prompt("Enter rejection reason")
        : "";

    if (action === "reject" && !rejectionReason) {
      return;
    }

    setPendingId(`${id}:${action}`);

    try {
      const response = await fetch(`/api/coordinator/payments/${id}/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, rejectionReason }),
      });

      const data = await response.json();

      if (!response.ok) {
        console.error("Verify API error:", data);
        alert(data.message || "Payment verification failed");
        return;
      }

      router.refresh();
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "Payment verification failed.");
    } finally {
      setPendingId("");
    }
  }

  if (!items.length) {
    return (
      <section className="rounded-[1.75rem] border border-dashed border-slate-300 bg-white/85 p-10 text-center text-sm text-slate-500 shadow-[0_18px_60px_-36px_rgba(15,23,42,0.18)]">
        No payment submissions match the current filter.
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
                  <th className="px-6 py-4">Student</th>
                  <th className="px-6 py-4">Voucher</th>
                  <th className="px-6 py-4">Submitted amount</th>
                  <th className="px-6 py-4">Transaction</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {items.map((item, index) => (
                  <motion.tr
                    key={item.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.18, delay: index * 0.02 }}
                  >
                    <td className="px-6 py-5">
                      <p className="font-semibold text-slate-950">{item.student_name}</p>
                      <p className="mt-1 text-sm text-slate-500">
                        {item.parent_name || "Parent pending"}
                      </p>
                    </td>
                    <td className="px-6 py-5">
                      <p className="font-semibold text-slate-950">{item.voucher_no}</p>
                      <p className="mt-1 text-sm text-slate-500">
                        Voucher amount: PKR {item.voucher_amount}
                      </p>
                    </td>
                    <td className="px-6 py-5">
                      <p className="font-semibold text-slate-950">PKR {item.paid_amount}</p>
                      <p className="mt-1 text-sm text-slate-500">{formatDate(item.paid_at)}</p>
                    </td>
                    <td className="px-6 py-5">
                      <p className="font-semibold text-slate-950">{item.transaction_id}</p>
                      <p className="mt-1 text-sm text-slate-500">
                        {item.phone || item.email || "No contact"}
                      </p>
                    </td>
                    <td className="px-6 py-5">
                      <span
                        className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${STATUS_STYLES[normalizeStatus(item.status)] || "bg-slate-100 text-slate-700"
                          }`}
                      >
                        {formatStatus(normalizeStatus(item.status))}
                      </span>
                    </td>
                    <td className="px-6 py-5">
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => openProofPreview(item)}
                          className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
                        >
                          View proof
                        </button>
                        {normalizeStatus(item.status) === "pending" ? (
                          <>
                            <button
                              type="button"
                              disabled={pendingId === `${item.id}:approve`}
                              onClick={() => verifyPayment(item.id, "approve")}
                              className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-100 disabled:opacity-60"
                            >
                              Approve payment
                            </button>
                            <button
                              type="button"
                              disabled={pendingId === `${item.id}:reject`}
                              onClick={() => verifyPayment(item.id, "reject")}
                              className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700 transition hover:bg-rose-100 disabled:opacity-60"
                            >
                              Reject payment
                            </button>
                          </>
                        ) : null}
                      </div>
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="grid gap-4 lg:hidden">
          {items.map((item, index) => (
            <motion.article
              key={item.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.18, delay: index * 0.02 }}
              className="rounded-[1.5rem] border border-white/70 bg-white/90 p-5 shadow-[0_18px_60px_-36px_rgba(15,23,42,0.22)]"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-lg font-semibold text-slate-950">{item.student_name}</p>
                  <p className="mt-1 text-sm text-slate-600">{item.voucher_no}</p>
                  <p className="mt-1 text-sm text-slate-500">
                    {item.parent_name || "Parent pending"}
                  </p>
                </div>
                <span
                  className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${STATUS_STYLES[normalizeStatus(item.status)] || "bg-slate-100 text-slate-700"
                    }`}
                >
                  {formatStatus(normalizeStatus(item.status))}
                </span>
              </div>

              <div className="mt-4 grid gap-2 text-sm text-slate-600">
                <p>Submitted amount: PKR {item.paid_amount}</p>
                <p>Voucher amount: PKR {item.voucher_amount}</p>
                <p>Transaction: {item.transaction_id}</p>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => openProofPreview(item)}
                  className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
                >
                  View proof
                </button>
                {normalizeStatus(item.status) === "pending" ? (
                  <>
                    <button
                      type="button"
                      disabled={pendingId === `${item.id}:approve`}
                      onClick={() => verifyPayment(item.id, "approve")}
                      className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-100 disabled:opacity-60"
                    >
                      Approve payment
                    </button>
                    <button
                      type="button"
                      disabled={pendingId === `${item.id}:reject`}
                      onClick={() => verifyPayment(item.id, "reject")}
                      className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700 transition hover:bg-rose-100 disabled:opacity-60"
                    >
                      Reject payment
                    </button>
                  </>
                ) : null}
              </div>
            </motion.article>
          ))}
        </div>
      </section>

      <PaymentProofPreview
        item={selectedItem}
        onClose={() => setSelectedItem(null)}
        onApprove={(item) => verifyPayment(item.id, "approve")}
        onReject={(item) => verifyPayment(item.id, "reject")}
      />
    </>
  );
}
