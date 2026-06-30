"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";

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
  not_submitted: "bg-slate-100 text-slate-700",
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
  const [classes, setClasses] = useState([]);
  const [history, setHistory] = useState([]);
  const [paymentMethods, setPaymentMethods] = useState([]);
  const [form, setForm] = useState({ classId: "", dueDate: "", monthLabel: "", baseAmount: "", lateFeeAmount: "", paymentMethodId: "" });
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [detailItem, setDetailItem] = useState(null);

  async function load() {
    setLoading(true);
    try {
      const response = await fetch("/api/coordinator/regular-fee-vouchers", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.message || "Unable to load regular fee vouchers.");
      setClasses(data.classes || []);
      setHistory(data.history || []);
      setPaymentMethods(data.paymentMethods || []);
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

  const selectedClass = useMemo(() => classes.find((item) => item.id === form.classId), [classes, form.classId]);

  function handleClassChange(value) {
    const nextClass = classes.find((item) => item.id === value) || null;
    setForm((current) => ({
      ...current,
      classId: value,
      baseAmount: nextClass?.regular_fee_amount ? String(nextClass.regular_fee_amount) : "",
    }));
  }

  async function submit(event) {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      const response = await fetch("/api/coordinator/regular-fee-vouchers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.message || "Unable to create vouchers.");
      setForm({ classId: "", dueDate: "", monthLabel: "", baseAmount: "", lateFeeAmount: "", paymentMethodId: "" });
      await load();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Unable to create vouchers.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6 min-h-screen">
      <section className="rounded-[2rem] border border-white/70 bg-[linear-gradient(135deg,rgba(255,255,255,0.92),rgba(241,248,255,0.92))] p-6 shadow-[0_24px_80px_-36px_rgba(15,23,42,0.25)] sm:p-8">
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">Regular fee vouchers</h1>
        <p className="mt-3 text-sm leading-7 text-slate-600 sm:text-base">Generate monthly vouchers for one class and keep batch history in one place.</p>
      </section>

      {error ? <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{error}</div> : null}

      <section className="rounded-[1.75rem] border border-white/70 bg-white/90 p-5 shadow-[0_20px_70px_-36px_rgba(15,23,42,0.25)] sm:p-6">
        <form className="grid gap-4 md:grid-cols-2" onSubmit={submit}>
          <label className="block">
            <span className="mb-2 block text-sm font-medium text-slate-700">Class</span>
            <select value={form.classId} onChange={(e) => handleClassChange(e.target.value)} className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm" required>
              <option value="">Select class</option>
              {classes.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.title}
                  {item.regular_fee_amount ? ` - ${formatMoney(item.regular_fee_amount)}` : ""}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="mb-2 block text-sm font-medium text-slate-700">Due date</span>
            <input type="date" value={form.dueDate} onChange={(e) => setForm((c) => ({ ...c, dueDate: e.target.value }))} className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm" required />
          </label>
          <label className="block">
            <span className="mb-2 block text-sm font-medium text-slate-700">Month label</span>
            <input value={form.monthLabel} onChange={(e) => setForm((c) => ({ ...c, monthLabel: e.target.value }))} placeholder="June 2026" className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm" />
          </label>
          <label className="block">
            <span className="mb-2 block text-sm font-medium text-slate-700">Monthly fee</span>
            <input type="number" min="1" value={form.baseAmount} readOnly className="w-full rounded-2xl border border-slate-200 bg-slate-100 px-4 py-3 text-sm text-slate-700" required />
          </label>
          <label className="block">
            <span className="mb-2 block text-sm font-medium text-slate-700">Late fee</span>
            <input type="number" min="0" value={form.lateFeeAmount} onChange={(e) => setForm((c) => ({ ...c, lateFeeAmount: e.target.value }))} className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm" />
          </label>
          <label className="block">
            <span className="mb-2 block text-sm font-medium text-slate-700">Bank / Payment Method</span>
            <select
              value={form.paymentMethodId}
              onChange={(e) => setForm((c) => ({ ...c, paymentMethodId: e.target.value }))}
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm"
              required
            >
              <option value="">Select bank</option>
              {paymentMethods.map((method) => (
                <option key={method.id} value={method.id}>
                  {method.name}
                  {method.bank_name ? ` - ${method.bank_name}` : ""}
                </option>
              ))}
            </select>
          </label>
          <div className="flex items-end justify-end">
            <button type="submit" disabled={submitting || !selectedClass} className="rounded-2xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white disabled:opacity-60">{submitting ? "Generating..." : "Generate vouchers"}</button>
          </div>
          {selectedClass?.regular_fee_amount ? (
            <p className="md:col-span-2 text-sm text-slate-500">
              Regular fee for {selectedClass.title} is auto-selected as {formatMoney(selectedClass.regular_fee_amount)}.
            </p>
          ) : null}
        </form>
      </section>

      <section className="rounded-[1.75rem] border border-white/70 bg-white/90 p-5 shadow-[0_20px_70px_-36px_rgba(15,23,42,0.25)] sm:p-6">
        <h2 className="text-xl font-semibold text-slate-950">Batch history</h2>
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="text-xs uppercase tracking-[0.18em] text-slate-500">
              <tr><th className="px-3 py-3">Batch</th><th className="px-3 py-3">Class</th><th className="px-3 py-3">Month</th><th className="px-3 py-3">Due</th><th className="px-3 py-3">Students</th><th className="px-3 py-3">Total</th><th className="px-3 py-3">Status</th><th className="px-3 py-3">Action</th></tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {history.length ? history.map((item) => (
                <tr key={item.id}>
                  <td className="px-3 py-4 font-semibold text-slate-950">{item.batch_no}</td>
                  <td className="px-3 py-4 text-slate-600">{item.class_title}</td>
                  <td className="px-3 py-4 text-slate-600">{item.month_label || "-"}</td>
                  <td className="px-3 py-4 text-slate-600">{formatDate(item.due_date)}</td>
                  <td className="px-3 py-4 text-slate-600">{item.student_count}</td>
                  <td className="px-3 py-4 text-slate-600">{formatMoney(item.total_amount)}</td>
                  <td className="px-3 py-4 text-slate-600">{item.status}</td>
                  <td className="px-3 py-4"><button type="button" onClick={() => setDetailItem(item)} className="rounded-xl border border-sky-200 bg-sky-50 px-3 py-2 text-xs font-semibold text-sky-700">View</button></td>
                </tr>
              )) : <tr><td className="px-3 py-8 text-center text-slate-500" colSpan={8}>{loading ? "Loading..." : "No regular fee voucher batches found."}</td></tr>}
            </tbody>
          </table>
        </div>
      </section>

      {detailItem ? (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/45 px-4 py-10">
          <div className="mx-auto max-w-4xl rounded-[2rem] bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between">
              <div><h3 className="text-2xl font-semibold text-slate-950">{detailItem.batch_no}</h3><p className="text-sm text-slate-500">{detailItem.class_title}</p></div>
              <button type="button" onClick={() => setDetailItem(null)} className="rounded-xl border border-slate-200 px-3 py-2 text-sm">Close</button>
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-4 text-sm">
              <div><p className="text-slate-500">Month</p><p className="font-semibold">{detailItem.month_label || "-"}</p></div>
              <div><p className="text-slate-500">Due date</p><p className="font-semibold">{formatDate(detailItem.due_date)}</p></div>
              <div><p className="text-slate-500">Students</p><p className="font-semibold">{detailItem.student_count}</p></div>
              <div><p className="text-slate-500">Total</p><p className="font-semibold">{formatMoney(detailItem.total_amount)}</p></div>
            </div>
            <p className="mt-5 text-sm font-semibold text-slate-950">Student voucher details</p>
            <div className="mt-4 overflow-x-auto rounded-2xl border border-slate-200">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase tracking-[0.18em] text-slate-500">
                  <tr>
                    <th className="px-4 py-3">Student</th>
                    <th className="px-4 py-3">Voucher No</th>
                    <th className="px-4 py-3">Phone</th>
                    <th className="px-4 py-3">Amount</th>
                    <th className="px-4 py-3">Payment Status</th>
                    <th className="px-4 py-3">Voucher Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {(detailItem.items || []).length ? detailItem.items.map((row) => (
                    <tr key={row.id}>
                      <td className="px-4 py-4">
                        <p className="font-semibold text-slate-950">{row.student_name || "-"}</p>
                        <p className="text-xs text-slate-500">{row.student_email || row.parent_email || "-"}</p>
                      </td>
                      <td className="px-4 py-4 text-slate-600">{row.voucher_no || "-"}</td>
                      <td className="px-4 py-4 text-slate-600">{row.student_phone || row.parent_phone || "-"}</td>
                      <td className="px-4 py-4 text-slate-600">{formatMoney(row.base_amount)}</td>
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
                    </tr>
                  )) : (
                    <tr>
                      <td className="px-4 py-6 text-center text-slate-500" colSpan={6}>No student voucher rows available.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
