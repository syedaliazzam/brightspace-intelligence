"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { ChevronDown } from "lucide-react";
import { useRouter } from "next/navigation";
import ClientPortal from "@/components/shared/ClientPortal";

export default function FeeVoucherForm({ leads, initialLeadId = "", showTrigger = true, onCreated, onClose }) {
  const router = useRouter();
  const normalizeClassLevel = (value) =>
    String(value || "").trim().toLowerCase();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [loadingOptions, setLoadingOptions] = useState(false);
  const [error, setError] = useState("");
  const [successEmail, setSuccessEmail] = useState(null);
  const [leadOpen, setLeadOpen] = useState(false);
  const [otherFeeOpen, setOtherFeeOpen] = useState(false);
  const [discountOpen, setDiscountOpen] = useState(false);
  const [paymentMethodOpen, setPaymentMethodOpen] = useState(false);
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

  useEffect(() => {
    if (!initialLeadId) return;
    setOpen(true);
    setForm((current) => ({
      ...current,
      registrationLeadId: initialLeadId,
    }));
  }, [initialLeadId]);

  useEffect(() => {
    if (!initialLeadId || !open) return;

    setForm((current) => {
      if (current.registrationLeadId === initialLeadId) return current;
      return {
        ...current,
        registrationLeadId: initialLeadId,
      };
    });
  }, [initialLeadId, open]);

  const selectedLead = useMemo(() => {
    const selectedId = initialLeadId || form.registrationLeadId;
    return leads.find((lead) => lead.id === selectedId) || null;
  }, [initialLeadId, form.registrationLeadId, leads]);
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
  const discountAmount = regularFeeAmount * (discountPercent / 100);
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

  function closeSelectState(setter) {
    window.setTimeout(() => setter(false), 0);
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
      await onCreated?.(data);
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

  async function copyParentNumber() {
    const parentNumber =
      successEmail?.recipient_phone ||
      selectedLead?.phone ||
      selectedLead?.parent_phone ||
      successEmail?.recipient_phone ||
      "";

    if (!parentNumber) {
      return;
    }

    await navigator.clipboard.writeText(parentNumber);
  }

  return (
    <>
      {showTrigger ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          disabled={pending || loadingOptions || !hasEligibleLead}
          className="inline-flex items-center justify-center rounded-2xl bg-[#0D5C48] px-4 py-3 text-sm font-semibold text-[#FAF7F0] transition hover:bg-[#063F32] disabled:cursor-not-allowed disabled:opacity-60"
        >
          Create fee voucher
        </button>
      ) : null}

      {open ? (
        <ClientPortal targetId="coordinator-page-portal-root">
        <div className="absolute inset-x-0 top-0 z-[9999] isolate flex min-h-full items-start justify-center overflow-visible bg-[#063F32]/45 px-4 pt-10 pb-10">
          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
            className="w-full max-w-3xl rounded-[2rem] border border-[#2D8A6A]/15 bg-[#FAF7F0] p-6 shadow-[0_24px_80px_-36px_rgba(13,59,46,0.24)] sm:p-8"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.24em] text-[#C9A227]">
                  Voucher issuance
                </p>
                <h2 className="mt-2 text-2xl font-semibold tracking-tight text-[#063F32]">
                  Create fee voucher
                </h2>
              </div>

              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  onClose?.();
                }}
                className="rounded-xl border border-[#2D8A6A]/20 bg-[#FAF7F0] px-3 py-2 text-sm font-semibold text-[#063F32] transition hover:bg-[#F1EADC]"
              >
                Close
              </button>
            </div>

            <form className="mt-6 grid gap-4 md:grid-cols-2" onSubmit={handleSubmit}>
              {initialLeadId && selectedLead ? (
                <div className="overflow-hidden rounded-[1.75rem] border border-[#2D8A6A]/15 bg-[linear-gradient(180deg,rgba(255,255,255,0.96)_0%,rgba(250,247,240,0.98)_100%)] shadow-[0_18px_60px_-36px_rgba(13,59,46,0.14)] md:col-span-2">
                  <div className="border-b border-[#2D8A6A]/15 bg-[#FAF7F0] px-4 py-3">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-sm font-semibold text-[#063F32]">Selected registration lead</span>
                      <span className="rounded-full bg-[#0D5C48] px-3 py-1 text-xs font-semibold text-[#FAF7F0]">
                        Locked
                      </span>
                    </div>
                  </div>
                  <div className="grid gap-0 sm:grid-cols-2 lg:grid-cols-4">
                    <div className="border-b border-r border-[#2D8A6A]/15 px-4 py-3">
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#245C4F]">Student</p>
                      <p className="mt-1 text-sm font-semibold text-[#063F32]">{selectedLead.student_name || "â€”"}</p>
                    </div>
                    <div className="border-b border-[#2D8A6A]/15 px-4 py-3 sm:border-r">
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#245C4F]">Parent</p>
                      <p className="mt-1 text-sm font-semibold text-[#063F32]">{selectedLead.parent_name || "Parent pending"}</p>
                    </div>
                    <div className="border-b border-r border-[#2D8A6A]/15 px-4 py-3 lg:border-b-0">
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#245C4F]">Class</p>
                      <p className="mt-1 text-sm font-semibold text-[#063F32]">{selectedLead.class_level || "â€”"}</p>
                    </div>
                    <div className="px-4 py-3">
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#245C4F]">Contact</p>
                      <p className="mt-1 text-sm font-semibold text-[#063F32]">{selectedLead.phone || selectedLead.email || "No contact"}</p>
                    </div>
                  </div>
                </div>
              ) : (
                <label className="block md:col-span-2">
                  <span className="mb-2 block text-sm font-medium text-[#245C4F]">
                    Registration lead
                  </span>
                  <div className="relative">
                    <select
                      value={form.registrationLeadId}
                      onMouseDown={() => setLeadOpen((current) => !current)}
                      onFocus={() => setLeadOpen(true)}
                      onBlur={() => closeSelectState(setLeadOpen)}
                      onChange={(event) => updateField("registrationLeadId", event.target.value)}
                      className="w-full appearance-none rounded-2xl border border-[#2D8A6A]/20 bg-[#FAF7F0] px-4 py-3 pr-11 text-sm text-[#063F32] outline-none transition focus:border-[#2D8A6A] focus:bg-white focus:ring-4 focus:ring-[#FFF5D6]"
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
                    <ChevronDown className={`pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#0D5C48] transition-transform duration-200 ${leadOpen ? "rotate-180" : "rotate-0"}`} />
                  </div>
                </label>
              )}

              <label className="flex items-center gap-3 rounded-2xl border border-[#2D8A6A]/15 bg-[linear-gradient(180deg,rgba(255,255,255,0.96)_0%,rgba(250,247,240,0.98)_100%)] px-4 py-3 md:col-span-2">
                <input
                  type="checkbox"
                  checked={form.regularFeeApplied}
                  onChange={(event) => {
                    const checked = event.target.checked;
                    updateField("regularFeeApplied", checked);
                    updateField("regularFeeId", checked ? selectedRegularFeeRecord?.id || "" : "");
                  }}
                  className="h-4 w-4 rounded border-[#2D8A6A]/30 text-[#0D5C48]"
                />
                <span className="text-sm font-medium text-[#063F32]">
                  Apply regular fee
                </span>
                <span className="ml-auto text-sm font-semibold text-[#063F32]">
                  {form.regularFeeApplied ? `PKR ${selectedRegularFee.toFixed(2)}` : "PKR 0.00"}
                </span>
              </label>

              <label className="block">
                <span className="mb-2 block text-sm font-medium text-[#245C4F]">Other fee</span>
                <div className="relative">
                  <select
                    value={form.otherFeeId}
                    onMouseDown={() => setOtherFeeOpen((current) => !current)}
                    onFocus={() => setOtherFeeOpen(true)}
                    onBlur={() => closeSelectState(setOtherFeeOpen)}
                    onChange={(event) => {
                      const nextOtherFee = options.otherFees.find((item) => item.id === event.target.value);
                      updateField("otherFeeId", event.target.value);
                      updateField("admissionFeeAmount", nextOtherFee ? String(nextOtherFee.amount || "") : "");
                    }}
                    className="w-full appearance-none rounded-2xl border border-[#2D8A6A]/20 bg-[#FAF7F0] px-4 py-3 pr-11 text-sm text-[#063F32] outline-none transition focus:border-[#2D8A6A] focus:bg-white focus:ring-4 focus:ring-[#FFF5D6]"
                  >
                    <option value="">Select other fee</option>
                    {options.otherFees.map((fee) => (
                      <option key={fee.id} value={fee.id}>
                        {(fee.title || fee.name || "Other fee")} - Rs. {Number(fee.amount || 0).toFixed(2)}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className={`pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#0D5C48] transition-transform duration-200 ${otherFeeOpen ? "rotate-180" : "rotate-0"}`} />
                </div>
              </label>

              <label className="block">
                <span className="mb-2 block text-sm font-medium text-[#245C4F]">Discount</span>
                <div className="relative">
                  <select
                    value={form.discountId}
                    onMouseDown={() => setDiscountOpen((current) => !current)}
                    onFocus={() => setDiscountOpen(true)}
                    onBlur={() => closeSelectState(setDiscountOpen)}
                    onChange={(event) => {
                      const nextDiscount = options.discounts.find((item) => item.id === event.target.value);
                      updateField("discountId", event.target.value);
                      updateField("discountPercent", nextDiscount?.percent || "");
                    }}
                    className="w-full appearance-none rounded-2xl border border-[#2D8A6A]/20 bg-[#FAF7F0] px-4 py-3 pr-11 text-sm text-[#063F32] outline-none transition focus:border-[#2D8A6A] focus:bg-white focus:ring-4 focus:ring-[#FFF5D6]"
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
                  <ChevronDown className={`pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#0D5C48] transition-transform duration-200 ${discountOpen ? "rotate-180" : "rotate-0"}`} />
                </div>
              </label>

              <label className="block">
                <span className="mb-2 block text-sm font-medium text-[#245C4F]">Due date</span>
                <input
                  type="date"
                  value={form.dueDate}
                  onChange={(event) => updateField("dueDate", event.target.value)}
                  className="w-full rounded-2xl border border-[#2D8A6A]/20 bg-[#FAF7F0] px-4 py-3 text-sm text-[#063F32] outline-none transition focus:border-[#2D8A6A] focus:bg-white focus:ring-4 focus:ring-[#FFF5D6]"
                />
              </label>

              <label className="block md:col-span-2">
                <span className="mb-2 block text-sm font-medium text-[#245C4F]">
                  Payment method
                </span>
                <div className="relative">
                  <select
                    value={form.paymentMethodId}
                    onMouseDown={() => setPaymentMethodOpen((current) => !current)}
                    onFocus={() => setPaymentMethodOpen(true)}
                    onBlur={() => closeSelectState(setPaymentMethodOpen)}
                    onChange={(event) => {
                      const method = options.paymentMethods.find((item) => item.id === event.target.value);
                      updateField("paymentMethodId", event.target.value);
                      updateField("paymentMethod", method?.method_key || method?.name || "");
                      updateField("paymentInstructions", method?.instructions || "");
                    }}
                    className="w-full appearance-none rounded-2xl border border-[#2D8A6A]/20 bg-[#FAF7F0] px-4 py-3 pr-11 text-sm text-[#063F32] outline-none transition focus:border-[#2D8A6A] focus:bg-white focus:ring-4 focus:ring-[#FFF5D6]"
                  >
                    <option value="">Select payment method</option>
                    {options.paymentMethods.map((method) => (
                      <option key={method.id} value={method.id}>
                        {method.name}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className={`pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#0D5C48] transition-transform duration-200 ${paymentMethodOpen ? "rotate-180" : "rotate-0"}`} />
                </div>
              </label>

              {selectedPaymentMethod ? (
                <div className="rounded-2xl border border-[#2D8A6A]/15 bg-[linear-gradient(180deg,rgba(255,255,255,0.96)_0%,rgba(250,247,240,0.98)_100%)] px-4 py-4 text-sm text-[#245C4F] md:col-span-2">
                  <p className="font-semibold text-[#063F32]">{selectedPaymentMethod.name}</p>
                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    {selectedPaymentMethod.bank_name ? <p><span className="font-medium text-[#063F32]">Bank Name:</span> {selectedPaymentMethod.bank_name}</p> : null}
                    {selectedPaymentMethod.account_title ? <p><span className="font-medium text-[#063F32]">Account Title:</span> {selectedPaymentMethod.account_title}</p> : null}
                    {selectedPaymentMethod.account_number ? <p><span className="font-medium text-[#063F32]">Account Number:</span> {selectedPaymentMethod.account_number}</p> : null}
                    {selectedPaymentMethod.iban ? <p><span className="font-medium text-[#063F32]">IBAN:</span> {selectedPaymentMethod.iban}</p> : null}
                    {selectedPaymentMethod.branch_code ? <p><span className="font-medium text-[#063F32]">Branch Code:</span> {selectedPaymentMethod.branch_code}</p> : null}
                    {selectedPaymentMethod.instructions ? <p className="sm:col-span-2"><span className="font-medium text-[#063F32]">Instructions:</span> {selectedPaymentMethod.instructions}</p> : null}
                  </div>
                </div>
              ) : null}

              {selectedLead ? (
                <div className="rounded-2xl border border-[#2D8A6A]/15 bg-[#FAF7F0] px-4 py-4 text-sm text-[#245C4F] md:col-span-2">
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-semibold text-[#063F32]">{selectedLead.student_name}</p>
                    {initialLeadId ? (
                      <span className="rounded-full bg-[#0D5C48] px-3 py-1 text-xs font-semibold text-[#FAF7F0]">
                        Selected lead locked
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-1">Class: {selectedLead.class_level || "â€”"}</p>
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
                <span className="mb-2 block text-sm font-medium text-[#245C4F]">
                  Payment instructions
                </span>
                <textarea
                  rows={4}
                  value={form.paymentInstructions}
                  onChange={(event) => updateField("paymentInstructions", event.target.value)}
                  className="w-full rounded-2xl border border-[#2D8A6A]/20 bg-[#FAF7F0] px-4 py-3 text-sm text-[#063F32] outline-none transition focus:border-[#2D8A6A] focus:bg-white focus:ring-4 focus:ring-[#FFF5D6]"
                  placeholder="Provide account title, account number, branch details, and reference notes."
                />
              </label>

              <div className="grid gap-3 rounded-2xl border border-[#2D8A6A]/15 bg-[linear-gradient(180deg,rgba(255,255,255,0.96)_0%,rgba(250,247,240,0.98)_100%)] px-4 py-4 text-sm text-[#245C4F] md:col-span-2 sm:grid-cols-3">
                <p>Regular Fee: <span className="font-semibold text-[#063F32]">PKR {regularFeeAmount.toFixed(2)}</span></p>
                <p>Other Fee: <span className="font-semibold text-[#063F32]">PKR {admissionFeeAmount.toFixed(2)}</span></p>
                <p>Discount on Regular Fee: <span className="font-semibold text-[#063F32]">PKR {discountAmount.toFixed(2)}</span></p>
                <p className="sm:col-span-3">Total Payable: <span className="font-semibold text-[#063F32]">PKR {totalAmount.toFixed(2)}</span></p>
              </div>

              {selectedLead ? (
                <div className="rounded-2xl border border-[#2D8A6A]/15 bg-[#FAF7F0] px-4 py-4 text-sm text-[#245C4F] md:col-span-2">
                  <p className="font-semibold text-[#063F32]">{selectedLead.student_name}</p>
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
                  onClick={() => {
                    setOpen(false);
                    onClose?.();
                  }}
                  className="rounded-2xl border border-[#2D8A6A]/20 bg-white px-4 py-3 text-sm font-semibold text-[#063F32] transition hover:bg-[#F1EADC]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={pending || loadingOptions}
                  className="rounded-2xl bg-[#0D5C48] px-4 py-3 text-sm font-semibold text-[#FAF7F0] transition hover:bg-[#063F32] disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {pending ? "Creating..." : "Create voucher"}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
        </ClientPortal>
      ) : null}

      {successEmail ? (
        <ClientPortal targetId="coordinator-page-portal-root">
        <div className="absolute inset-x-0 top-0 z-[10000] isolate flex min-h-full items-start justify-center overflow-visible bg-[#063F32]/45 px-4 pt-10 pb-10">
          <div className="w-full max-w-2xl rounded-[2rem] border border-[#2D8A6A]/15 bg-[#FAF7F0] p-6 shadow-[0_24px_80px_-36px_rgba(13,59,46,0.24)] sm:p-8">
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-[#C9A227]">
              Voucher Created Successfully
            </p>
            <div className="mt-4 space-y-3 rounded-2xl border border-[#2D8A6A]/15 bg-[linear-gradient(180deg,rgba(255,255,255,0.96)_0%,rgba(250,247,240,0.98)_100%)] p-4 text-sm text-[#245C4F]">
              <p><span className="font-semibold text-[#063F32]">Recipient:</span> {successEmail.recipient_email || "â€”"}</p>
              <p><span className="font-semibold text-[#063F32]">Subject:</span> {successEmail.subject || "â€”"}</p>
              <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-[#2D8A6A]/15 bg-[#FAF7F0] px-4 py-3">
                <p className="text-sm text-[#245C4F]">
                  <span className="font-semibold text-[#063F32]">Parent Number:</span>{" "}
                  {successEmail?.recipient_phone || selectedLead?.phone || selectedLead?.parent_phone || "â€”"}
                </p>
                <button
                  type="button"
                  onClick={() => void copyParentNumber()}
                  className="rounded-full border border-[#2D8A6A]/20 bg-white px-3 py-1.5 text-xs font-semibold text-[#0D5C48] transition hover:bg-[#F1EADC]"
                >
                  Copy Number
                </button>
              </div>
              <div>
                <p className="font-semibold text-[#063F32]">Email Body</p>
                <pre className="mt-2 max-h-72 overflow-auto whitespace-pre-wrap rounded-2xl border border-[#2D8A6A]/15 bg-[#FAF7F0] p-4 text-xs text-[#245C4F]">
                  {successEmail.body_text || successEmail.body_html || ""}
                </pre>
              </div>
              {successEmail.payment_submit_url ? (
                <div className="rounded-2xl border border-[#E4C766]/40 bg-[#FFF5D6] p-4 text-sm text-[#063F32]">
                  <p className="font-semibold">Payment submit link</p>
                  <a
                    href={successEmail.payment_submit_url}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-2 inline-flex break-all font-medium text-[#0D5C48] underline-offset-4 hover:underline"
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
                className="rounded-2xl bg-[#0D5C48] px-4 py-3 text-sm font-semibold text-[#FAF7F0] transition hover:bg-[#063F32]"
              >
                Copy Message
              </button>
              {successEmail.payment_submit_url ? (
                <a
                  href={successEmail.payment_submit_url}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-2xl border border-[#2D8A6A]/20 bg-[#FAF7F0] px-4 py-3 text-sm font-semibold text-[#0D5C48] transition hover:bg-[#F1EADC]"
                >
                  Open Payment Page
                </a>
              ) : null}
                <button
                  type="button"
                  onClick={() => {
                    setSuccessEmail(null);
                    setOpen(false);
                    onClose?.();
                  }}
                  className="rounded-2xl border border-[#2D8A6A]/20 bg-[#FAF7F0] px-4 py-3 text-sm font-semibold text-[#0D5C48] transition hover:bg-[#F1EADC]"
                >
                  Close
              </button>
            </div>
          </div>
        </div>
        </ClientPortal>
      ) : null}
    </>
  );
}
