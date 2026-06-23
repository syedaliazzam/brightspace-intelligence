"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { useRouter } from "next/navigation";

export default function FeeVoucherForm({ leads }) {
  const router = useRouter();
  const normalizeClassLevel = (value) =>
    String(value || "").trim().toLowerCase();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [loadingOptions, setLoadingOptions] = useState(false);
  const [error, setError] = useState("");
  const [successEmail, setSuccessEmail] = useState(null);
  const [options, setOptions] = useState({
    discounts: [],
    feeSettings: {},
    otherFees: [],
    regularFees: [],
    paymentMethods: [],
  });
  const [form, setForm] = useState({
    registrationLeadId: "",
    regularFeeApplied: true,
    regularFeeId: "",
    otherFeeId: "",
    admissionFeeAmount: "",
    discountId: "",
    discountPercent: "",
    dueDate: "",
    paymentMethodId: "",
    paymentMethod: "",
    paymentInstructions: "",
  });

  const selectedLead = useMemo(
    () => leads.find((lead) => lead.id === form.registrationLeadId),
    [form.registrationLeadId, leads]
  );
  const selectedRegularFee = useMemo(() => {
    if (!selectedLead) return 0;
    const match = options.regularFees.find(
      (item) =>
        normalizeClassLevel(item.class_level) === normalizeClassLevel(selectedLead.class_level)
    );
    return Number(match?.amount || 0);
  }, [options.regularFees, selectedLead]);
  const selectedRegularFeeRecord = useMemo(() => {
    if (!selectedLead) return null;
    return (
      options.regularFees.find(
        (item) =>
          normalizeClassLevel(item.class_level) === normalizeClassLevel(selectedLead.class_level)
      ) || null
    );
  }, [options.regularFees, selectedLead]);
  const selectedOtherFee = useMemo(
    () => options.otherFees.find((item) => item.id === form.otherFeeId),
    [form.otherFeeId, options.otherFees]
  );
  const eligibleLeads = useMemo(
    () =>
      leads.filter(
        (lead) =>
          lead.can_create_voucher === true ||
          lead.canCreateVoucher === true ||
          (lead.status === "new_lead" && !lead.voucher_id && !lead.voucherId)
      ),
    [leads]
  );
  const maxDiscountPercent = Number(options.coordinatorMaxDiscountPercent || options.feeSettings?.coordinator_max_discount_percent?.value || 20);
  const selectedPaymentMethod = useMemo(
    () => options.paymentMethods.find((method) => method.id === form.paymentMethodId),
    [form.paymentMethodId, options.paymentMethods]
  );
  const regularFeeAmount = form.regularFeeApplied ? selectedRegularFee : 0;
  const admissionFeeAmount = Number(form.admissionFeeAmount || selectedOtherFee?.amount || 0);
  const discountPercent = Number(form.discountPercent || 0);
  const subtotalAmount = regularFeeAmount + admissionFeeAmount;
  const discountAmount = subtotalAmount * (discountPercent / 100);
  const totalAmount = subtotalAmount - discountAmount;
  const hasEligibleLead = eligibleLeads.length > 0;

  useEffect(() => {
    let active = true;

    async function loadOptions() {
      setLoadingOptions(true);
      setError("");
      try {
        const response = await fetch("/api/coordinator/fee-vouchers/options", {
          cache: "no-store",
        });
        const data = await response.json();
        if (!response.ok) {
          throw new Error(data?.message || "Unable to load voucher options.");
        }
        if (active) {
          setOptions({
            discounts: data.discounts || [],
            feeSettings: data.feeSettings || {},
            otherFees: data.otherFees || [],
            regularFees: data.regularFees || [],
            paymentMethods: data.paymentMethods || [],
            coordinatorMaxDiscountPercent: data.coordinatorMaxDiscountPercent || 20,
          });
        }
      } catch (optionError) {
        if (active) {
          setError(
            optionError instanceof Error
              ? optionError.message
              : "Unable to load voucher options."
          );
        }
      } finally {
        if (active) {
          setLoadingOptions(false);
        }
      }
    }

    if (open) {
      void loadOptions();
    }

    return () => {
      active = false;
    };
  }, [open]);

  function updateField(name, value) {
    setForm((current) => ({
      ...current,
      [name]: value,
    }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setPending(true);
    setError("");

    try {
      const payload = {
        ...form,
        regularFeeId: form.regularFeeApplied ? selectedRegularFeeRecord?.id || "" : "",
        regularFeeAmount: form.regularFeeApplied ? Number(selectedRegularFeeRecord?.amount || 0) : 0,
      };
      const response = await fetch("/api/coordinator/fee-vouchers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.message || "Unable to create voucher.");
      }

      setSuccessEmail(data?.email || null);
      router.refresh();
      setForm({
        registrationLeadId: "",
        regularFeeApplied: true,
        regularFeeId: "",
        otherFeeId: "",
        admissionFeeAmount: "",
        discountId: "",
        discountPercent: "",
        dueDate: "",
        paymentMethodId: "",
        paymentMethod: "",
        paymentInstructions: "",
      });
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Unable to create voucher."
      );
    } finally {
      setPending(false);
    }
  }

  async function copyEmailBody() {
    if (!successEmail?.body_text) {
      return;
    }

    await navigator.clipboard.writeText(successEmail.body_text);
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        disabled={pending || loadingOptions || !hasEligibleLead}
        className="inline-flex items-center justify-center rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
      >
        Create fee voucher
      </button>

      {open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 px-4 py-8">
          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
            className="w-full max-w-3xl rounded-[2rem] border border-white/70 bg-white p-6 shadow-[0_24px_80px_-36px_rgba(15,23,42,0.32)] sm:p-8"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.24em] text-sky-700">
                  Voucher issuance
                </p>
                <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">
                  Create fee voucher
                </h2>
              </div>

              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
              >
                Close
              </button>
            </div>

            <form className="mt-6 grid gap-4 md:grid-cols-2" onSubmit={handleSubmit}>
              <label className="block md:col-span-2">
                <span className="mb-2 block text-sm font-medium text-slate-700">
                  Registration lead
                </span>
                <select
                  value={form.registrationLeadId}
                  onChange={(event) => updateField("registrationLeadId", event.target.value)}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-sky-400 focus:bg-white focus:ring-4 focus:ring-sky-100"
                >
                  <option value="" disabled>
                    Select registration lead
                  </option>
                  {eligibleLeads.map((lead) => (
                    <option key={lead.id} value={lead.id}>
                      {lead.student_name} - {lead.class_level}
                    </option>
                  ))}
                </select>
              </label>

              <label className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 md:col-span-2">
                <input
                  type="checkbox"
                  checked={form.regularFeeApplied}
                  onChange={(event) => {
                    const checked = event.target.checked;
                    updateField("regularFeeApplied", checked);
                    updateField("regularFeeId", checked ? selectedRegularFeeRecord?.id || "" : "");
                  }}
                  className="h-4 w-4 rounded border-slate-300 text-slate-950"
                />
                <span className="text-sm font-medium text-slate-700">
                  Apply regular fee
                </span>
                <span className="ml-auto text-sm font-semibold text-slate-950">
                  {form.regularFeeApplied ? `PKR ${selectedRegularFee.toFixed(2)}` : "PKR 0.00"}
                </span>
              </label>

              <label className="block">
                <span className="mb-2 block text-sm font-medium text-slate-700">Other fee</span>
                <select
                  value={form.otherFeeId}
                  onChange={(event) => {
                    const nextOtherFee = options.otherFees.find((item) => item.id === event.target.value);
                    updateField("otherFeeId", event.target.value);
                    updateField("admissionFeeAmount", nextOtherFee ? String(nextOtherFee.amount || "") : "");
                  }}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-sky-400 focus:bg-white focus:ring-4 focus:ring-sky-100"
                >
                  <option value="">Select other fee</option>
                  {options.otherFees.map((fee) => (
                    <option key={fee.id} value={fee.id}>
                      {(fee.title || fee.name || "Other fee")} - Rs. {Number(fee.amount || 0).toFixed(2)}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className="mb-2 block text-sm font-medium text-slate-700">Discount</span>
                <select
                  value={form.discountId}
                  onChange={(event) => {
                    const nextDiscount = options.discounts.find((item) => item.id === event.target.value);
                    updateField("discountId", event.target.value);
                    updateField("discountPercent", nextDiscount?.percent || "");
                  }}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-sky-400 focus:bg-white focus:ring-4 focus:ring-sky-100"
                >
                  <option value="">No discount</option>
                  {options.discounts
                    .filter((discount) => Number(discount.percent || 0) <= maxDiscountPercent)
                    .map((discount) => (
                      <option key={discount.id} value={discount.id}>
                        {discount.label}
                      </option>
                    ))}
                </select>
              </label>

              <label className="block">
                <span className="mb-2 block text-sm font-medium text-slate-700">Due date</span>
                <input
                  type="date"
                  value={form.dueDate}
                  onChange={(event) => updateField("dueDate", event.target.value)}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-sky-400 focus:bg-white focus:ring-4 focus:ring-sky-100"
                />
              </label>

              <label className="block md:col-span-2">
                <span className="mb-2 block text-sm font-medium text-slate-700">
                  Payment method
                </span>
                <select
                  value={form.paymentMethodId}
                  onChange={(event) => {
                    const method = options.paymentMethods.find((item) => item.id === event.target.value);
                    updateField("paymentMethodId", event.target.value);
                    updateField("paymentMethod", method?.method_key || method?.name || "");
                    updateField("paymentInstructions", method?.instructions || "");
                  }}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-sky-400 focus:bg-white focus:ring-4 focus:ring-sky-100"
                >
                  <option value="">Select payment method</option>
                  {options.paymentMethods.map((method) => (
                    <option key={method.id} value={method.id}>
                      {method.name}
                    </option>
                  ))}
                </select>
              </label>

              {selectedPaymentMethod ? (
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-700 md:col-span-2">
                  <p className="font-semibold text-slate-950">{selectedPaymentMethod.name}</p>
                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    {selectedPaymentMethod.bank_name ? <p><span className="font-medium text-slate-900">Bank Name:</span> {selectedPaymentMethod.bank_name}</p> : null}
                    {selectedPaymentMethod.account_title ? <p><span className="font-medium text-slate-900">Account Title:</span> {selectedPaymentMethod.account_title}</p> : null}
                    {selectedPaymentMethod.account_number ? <p><span className="font-medium text-slate-900">Account Number:</span> {selectedPaymentMethod.account_number}</p> : null}
                    {selectedPaymentMethod.iban ? <p><span className="font-medium text-slate-900">IBAN:</span> {selectedPaymentMethod.iban}</p> : null}
                    {selectedPaymentMethod.branch_code ? <p><span className="font-medium text-slate-900">Branch Code:</span> {selectedPaymentMethod.branch_code}</p> : null}
                    {selectedPaymentMethod.instructions ? <p className="sm:col-span-2"><span className="font-medium text-slate-900">Instructions:</span> {selectedPaymentMethod.instructions}</p> : null}
                  </div>
                </div>
              ) : null}

              {selectedLead ? (
                <div className="rounded-2xl bg-slate-50 px-4 py-4 text-sm text-slate-600 md:col-span-2">
                  <p className="font-semibold text-slate-900">{selectedLead.student_name}</p>
                  <p className="mt-1">Class: {selectedLead.class_level || "—"}</p>
                  {form.regularFeeApplied ? (
                    selectedRegularFee > 0 ? (
                      <p className="mt-1">Regular fee: PKR {selectedRegularFee.toFixed(2)}</p>
                    ) : (
                      <p className="mt-1 text-amber-700">
                        No regular fee configured for this class. Please ask admin to add it.
                      </p>
                    )
                  ) : null}
                </div>
              ) : null}

              <label className="block md:col-span-2">
                <span className="mb-2 block text-sm font-medium text-slate-700">
                  Payment instructions
                </span>
                <textarea
                  rows={4}
                  value={form.paymentInstructions}
                  onChange={(event) => updateField("paymentInstructions", event.target.value)}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-sky-400 focus:bg-white focus:ring-4 focus:ring-sky-100"
                  placeholder="Provide account title, account number, branch details, and reference notes."
                />
              </label>

              <div className="grid gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-700 md:col-span-2 sm:grid-cols-3">
                <p>Subtotal: <span className="font-semibold text-slate-950">PKR {subtotalAmount.toFixed(2)}</span></p>
                <p>Discount: <span className="font-semibold text-slate-950">PKR {discountAmount.toFixed(2)}</span></p>
                <p>Total: <span className="font-semibold text-slate-950">PKR {totalAmount.toFixed(2)}</span></p>
              </div>

              {selectedLead ? (
                <div className="rounded-2xl bg-slate-50 px-4 py-4 text-sm text-slate-600 md:col-span-2">
                  <p className="font-semibold text-slate-900">{selectedLead.student_name}</p>
                  <p className="mt-1">
                    {selectedLead.parent_name || "Parent pending"} | {selectedLead.phone || selectedLead.email || "No contact"}
                  </p>
                </div>
              ) : null}

              {error ? (
                <p className="rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-700 md:col-span-2">
                  {error}
                </p>
              ) : null}

              <div className="flex justify-end gap-3 md:col-span-2">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={pending || loadingOptions}
                  className="rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {pending ? "Creating..." : "Create voucher"}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      ) : null}

      {successEmail ? (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/50 px-4 py-8">
          <div className="w-full max-w-2xl rounded-[2rem] border border-white/70 bg-white p-6 shadow-[0_24px_80px_-36px_rgba(15,23,42,0.32)] sm:p-8">
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-emerald-700">
              Voucher Created Successfully
            </p>
            <div className="mt-4 space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
              <p><span className="font-semibold text-slate-950">Recipient:</span> {successEmail.recipient_email || "—"}</p>
              <p><span className="font-semibold text-slate-950">Subject:</span> {successEmail.subject || "—"}</p>
              <div>
                <p className="font-semibold text-slate-950">Email Body</p>
                <pre className="mt-2 max-h-72 overflow-auto whitespace-pre-wrap rounded-2xl border border-slate-200 bg-white p-4 text-xs text-slate-700">
                  {successEmail.body_text || successEmail.body_html || ""}
                </pre>
              </div>
              {successEmail.payment_submit_url ? (
                <div className="rounded-2xl border border-sky-100 bg-sky-50 p-4 text-sm text-sky-900">
                  <p className="font-semibold">Payment submit link</p>
                  <a
                    href={successEmail.payment_submit_url}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-2 inline-flex break-all font-medium text-sky-700 underline-offset-4 hover:underline"
                  >
                    {successEmail.payment_submit_url}
                  </a>
                </div>
              ) : null}
            </div>
            <div className="mt-6 flex flex-wrap justify-end gap-3">
              <button
                type="button"
                onClick={copyEmailBody}
                className="rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
              >
                Copy Email
              </button>
              {successEmail.payment_submit_url ? (
                <a
                  href={successEmail.payment_submit_url}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm font-semibold text-sky-700 transition hover:bg-sky-100"
                >
                  Open Payment Page
                </a>
              ) : null}
              <button
                type="button"
                onClick={() => {
                  setSuccessEmail(null);
                  setOpen(false);
                }}
                className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
