"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import ClientPortal from "@/components/shared/ClientPortal";
import PaginationControls from "@/components/teacher/PaginationControls";
import { CheckCircle2, CircleDashed, Send, FileCheck2, ClipboardList } from "lucide-react";

const PAGE_SIZE = 7;

function formatDate(value) {
  if (!value) return "No date";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "No date";
  return new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

function statusLabel(value) {
  return String(value || "")
    .split("_")
    .filter(Boolean)
    .map((part) => part[0].toUpperCase() + part.slice(1))
    .join(" ");
}

function admissionStatusLabel(value) {
  const normalized = String(value || "").toLowerCase();
  if (!normalized || normalized === "pending") return "New Registrations";
  if (normalized === "sent") return "Admission Form Sent";
  if (normalized === "reminded") return "Reminder Sent";
  if (normalized === "overdue") return "Overdue";
  if (normalized === "not_submitted") return "Form Not Submitted";
  if (normalized === "submitted" || normalized === "registered") return "Form Submitted";
  if (normalized === "not_submitted") return "Not Submitted";
  return statusLabel(normalized);
}

function admissionStatusTone(value) {
  const normalized = String(value || "").toLowerCase();
  if (["submitted", "sent", "registered", "pending"].includes(normalized)) return "bg-[#EAF6EF] text-[#0D5C48]";
  if (["reminded"].includes(normalized)) return "bg-[#FFF5D6] text-[#8A6A00]";
  if (["overdue", "not_submitted", "failed"].includes(normalized)) return "bg-rose-50 text-rose-700";
  return "bg-[#EAF6EF] text-[#0D5C48]";
}

function textOrDash(value) {
  const text = String(value || "").trim();
  return text || "-";
}

function truncate(value, maxLength = 72) {
  const text = String(value || "").trim();
  if (!text) return "-";
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength - 3)}...`;
}

function InfoCell({ label, value }) {
  return (
    <div>
      <dt className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#0D5C48]">{label}</dt>
      <dd className="mt-1 text-sm leading-6 text-[#063F32]">{value || "-"}</dd>
    </div>
  );
}

export default function InterestedStudentsPanel({
  items = [],
  onRefresh,
  showDetailsButton = true,
  showActionsColumn = true,
  showFlowColumn = false,
}) {
  const [page, setPage] = useState(1);
  const [selectedLead, setSelectedLead] = useState(null);
  const [selectedMessage, setSelectedMessage] = useState(null);
  const [message, setMessage] = useState("");
  const [loadingId, setLoadingId] = useState("");
  const [previewAdmissionFeeId, setPreviewAdmissionFeeId] = useState("");
  const [previewDiscountId, setPreviewDiscountId] = useState("");
  const [previewPaymentMethodId, setPreviewPaymentMethodId] = useState("");
  const [previewPaymentInstructions, setPreviewPaymentInstructions] = useState("");
  const [paymentOptions, setPaymentOptions] = useState({
    discounts: [],
    paymentMethods: [],
    regularFees: [],
    admissionFees: [],
    classLevels: [],
    coordinatorMaxDiscountPercent: 20,
  });

  useEffect(() => {
    let active = true;

    async function loadPaymentOptions() {
      try {
        const response = await fetch("/api/public/admission-form-options", { cache: "no-store" });
        const data = await response.json();
        if (!response.ok || !active) return;

        setPaymentOptions({
          discounts: Array.isArray(data.discounts) ? data.discounts : [],
          paymentMethods: Array.isArray(data.paymentMethods) ? data.paymentMethods : [],
          regularFees: Array.isArray(data.regularFees) ? data.regularFees : [],
          admissionFees: Array.isArray(data.admissionFees) ? data.admissionFees : [],
          classLevels: Array.isArray(data.classLevels) ? data.classLevels : [],
          coordinatorMaxDiscountPercent: Number(data.coordinatorMaxDiscountPercent || 20),
        });
      } catch {
        // Keep popup usable even when payment options are unavailable.
      }
    }

    void loadPaymentOptions();

    return () => {
      active = false;
    };
  }, []);

  const selectedClassLevel = String(selectedLead?.class_level || "").trim();
  const regularFee = useMemo(() => {
    const normalizedLeadClass = selectedClassLevel.toLowerCase();
    return (
      paymentOptions.regularFees.find((item) => String(item.class_level || "").trim().toLowerCase() === normalizedLeadClass) ||
      null
    );
  }, [paymentOptions.regularFees, selectedClassLevel]);

  const admissionFee = useMemo(() => {
    const normalizedLeadClass = selectedClassLevel.toLowerCase();
    return (
      paymentOptions.admissionFees.find((item) => {
        const itemClass = String(item.class_level || "").trim().toLowerCase();
        return String(item.fee_type || "").trim().toLowerCase() === "admission_fee" && (!normalizedLeadClass || !itemClass || itemClass === normalizedLeadClass);
      }) || null
    );
  }, [paymentOptions.admissionFees, selectedClassLevel]);

  const discount = useMemo(() => {
    const eligibleDiscounts = paymentOptions.discounts.filter(
      (item) => Number(item.percent || 0) <= Number(paymentOptions.coordinatorMaxDiscountPercent || 20)
    );
    return eligibleDiscounts.find((item) => item.id === previewDiscountId) || null;
  }, [paymentOptions.coordinatorMaxDiscountPercent, paymentOptions.discounts, previewDiscountId]);

  const selectedPreviewAdmissionFee =
    paymentOptions.admissionFees.find((item) => item.id === previewAdmissionFeeId) || null;
  const selectedPreviewPaymentMethod =
    paymentOptions.paymentMethods.find((item) => item.id === previewPaymentMethodId) || null;

  const regularFeeAmount = Number(regularFee?.amount || 0);
  const admissionFeeAmount = Number(selectedPreviewAdmissionFee?.amount || 0);
  const discountPercent = Number(discount?.percent || 0);
  const discountAmount = Math.round(regularFeeAmount * (discountPercent / 100));
  const totalAmount = Math.max(regularFeeAmount - discountAmount + admissionFeeAmount, 0);
  const totalPages = Math.max(1, Math.ceil(items.length / PAGE_SIZE));
  const currentPage = Math.min(Math.max(1, page), totalPages);
  const visibleItems = useMemo(() => {
    const startIndex = (currentPage - 1) * PAGE_SIZE;
    return items.slice(startIndex, startIndex + PAGE_SIZE);
  }, [currentPage, items]);

  useEffect(() => {
    if (!selectedLead) return;
    setPreviewAdmissionFeeId("");
    setPreviewDiscountId("");
    setPreviewPaymentMethodId("");
    setPreviewPaymentInstructions("");
  }, [selectedLead]);

  function getLeadStage(item) {
    const status = String(item.admission_form_status || item.status || "pending").toLowerCase();
    return {
      status,
      sent: Boolean(item.admission_form_sent_at) || ["sent", "reminded", "submitted", "overdue", "not_submitted"].includes(status),
      submitted: Boolean(item.admission_form_submitted_at) || status === "submitted" || status === "registered",
      reminded: Boolean(item.admission_form_last_reminder_at) || status === "reminded",
      overdue: status === "overdue",
    };
  }

  function FlowStep({ active, done, icon: Icon, label }) {
    return (
      <div
        className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11px] font-semibold ${
          done
            ? "border-[#2D8A6A]/20 bg-[#EAF6EF] text-[#0D5C48]"
            : active
              ? "border-[#E4C766]/50 bg-[#FFF5D6] text-[#8A6B00]"
              : "border-[#2D8A6A]/10 bg-white text-[#245C4F]"
        }`}
      >
        <Icon className="h-3.5 w-3.5" strokeWidth={2.2} />
        <span>{label}</span>
      </div>
    );
  }

  async function sendAdmissionForm(item) {
    if (!item?.id) return;

    setLoadingId(item.id);
    setMessage("");

    try {
      const payload = {
        admissionFeeId: previewAdmissionFeeId,
        admissionFeeAmount: selectedPreviewAdmissionFee?.amount || "",
        discountPercent: discount?.percent || "",
        discountId: previewDiscountId,
        paymentMethodId: previewPaymentMethodId,
        paymentMethodName: selectedPreviewPaymentMethod?.name || "",
        paymentInstructions: previewPaymentInstructions,
      };
      const response = await fetch(
        `/api/coordinator/interested-students/${encodeURIComponent(item.id)}/registration-link`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );
      const data = await response.json();

      if (!response.ok || !data?.success) {
        throw new Error(data?.message || "Unable to generate registration message.");
      }

      setMessage(
        data.already_generated
          ? "Existing admission form link loaded and sent."
          : "Admission form link sent."
      );
      if (data?.whatsapp_url) {
        window.open(data.whatsapp_url, "_blank", "noopener,noreferrer");
      }
      await onRefresh?.();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to generate registration message.");
    } finally {
      setLoadingId("");
    }
  }

  if (!items.length) {
    return (
      <section className="rounded-[1.75rem] border border-dashed border-[#2D8A6A]/25 bg-[#FAF7F0]/80 p-10 text-center text-sm text-[#245C4F] shadow-[0_18px_60px_-36px_rgba(13,59,46,0.18)]">
        No interested students found.
      </section>
    );
  }

  return (
    <>
      <section className="hidden overflow-hidden rounded-[2rem] border border-[#2D8A6A]/15 bg-[linear-gradient(180deg,rgba(255,255,255,0.96)_0%,rgba(250,247,240,0.98)_100%)] shadow-[0_20px_70px_-36px_rgba(13,59,46,0.18)] backdrop-blur-xl min-[992px]:block">
        {message ? (
          <div className="border-b border-[#2D8A6A]/10 px-6 py-4 text-sm font-medium text-[#0D5C48]">{message}</div>
        ) : null}
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-[#F1EADC]">
            <thead className="bg-[linear-gradient(180deg,#FAF7F0_0%,#F1EADC_100%)]">
              <tr className="text-left text-xs font-semibold uppercase tracking-[0.18em] text-[#0D5C48]">
                <th className="px-6 py-4">#</th>
                <th className="px-6 py-4">Parent / Guardian</th>
                <th className="px-6 py-4">Form Status</th>
                <th className="px-6 py-4">WhatsApp Number</th>
                <th className="px-6 py-4">Email Address</th>
                <th className="px-6 py-4">Child Name</th>
                <th className="px-6 py-4">Child Age</th>
                <th className="px-6 py-4">Interested Level</th>
                <th className="px-6 py-4">City / Country</th>
                <th className="px-6 py-4">Message</th>
                {showFlowColumn ? <th className="px-6 py-4">Flow</th> : null}
                <th className="px-6 py-4">Created At</th>
                {showActionsColumn ? <th className="px-6 py-4 text-right">Action</th> : null}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F1EADC]">
              {visibleItems.map((item, index) => (
                <Fragment key={item.id}>
                  <tr key={item.id} className="align-top">
                    <td className="px-5 py-5 text-sm font-semibold text-[#0D5C48]">
                      {String((currentPage - 1) * PAGE_SIZE + index + 1).padStart(2, "0")}
                    </td>
                    <td className="px-5 py-5 text-[#063F32]">{textOrDash(item.parent_name)}</td>
                    <td className="px-5 py-5">
                      <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${admissionStatusTone(item.admission_form_status)}`}>
                        {admissionStatusLabel(item.admission_form_status || item.status)}
                      </span>
                      {item.admission_form_due_at && String(item.admission_form_status || item.status || "").toLowerCase() !== "submitted" ? (
                        <p className="mt-2 text-[11px] font-medium text-[#245C4F]">
                          Due: {formatDate(item.admission_form_due_at)}
                        </p>
                      ) : null}
                    </td>
                    <td className="px-5 py-5 text-[#245C4F]">{textOrDash(item.phone)}</td>
                    <td className="px-5 py-5 text-[#245C4F]">{textOrDash(item.email)}</td>
                    <td className="px-5 py-5 font-semibold text-[#063F32]">{textOrDash(item.student_name)}</td>
                    <td className="px-5 py-5 text-[#245C4F]">{textOrDash(item.student_age)}</td>
                    <td className="px-5 py-5 text-[#245C4F]">{textOrDash(item.class_level)}</td>
                    <td className="px-5 py-5 text-[#245C4F]">{textOrDash(item.city_country)}</td>
                    <td className="px-5 py-5 text-[#245C4F]">
                      <div className="relative inline-block">
                        <button
                          type="button"
                          onClick={() => setSelectedMessage((current) => (current?.id === item.id ? null : item))}
                          className="max-w-[18rem] text-left font-medium text-[#0D5C48] underline decoration-dotted underline-offset-4 transition hover:text-[#063F32]"
                        >
                          {truncate(item.message || item.notes, 64)}
                        </button>
                        {selectedMessage?.id === item.id ? (
                          <div
                            className={`absolute left-1/2 z-[10000] w-[min(32rem,calc(100vw-3rem))] -translate-x-1/2 rounded-[1.5rem] border border-[#2D8A6A]/15 bg-[#FAF7F0] p-4 shadow-[0_16px_50px_-36px_rgba(13,59,46,0.18)] ${
                              index === 0 ? "top-full mt-3" : "bottom-full mb-3"
                            }`}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#C9A227]">
                                  Full message
                                </p>
                                <p className="mt-2 text-sm font-semibold text-[#063F32]">
                                  {textOrDash(item.student_name)}
                                </p>
                              </div>
                              <button
                                type="button"
                                onClick={() => setSelectedMessage(null)}
                                className="rounded-xl border border-[#2D8A6A]/20 bg-white px-3 py-2 text-xs font-semibold text-[#063F32] transition hover:bg-[#F1EADC]"
                              >
                                Close
                              </button>
                            </div>
                            <p className="mt-4 whitespace-pre-wrap break-words text-sm leading-7 text-[#245C4F]">
                              {textOrDash(item.message || item.notes)}
                            </p>
                          </div>
                        ) : null}
                      </div>
                    </td>
                    {showFlowColumn ? (
                      <td className="px-5 py-5">
                        {(() => {
                          const stage = getLeadStage(item);
                          return (
                            <div className="flex flex-wrap gap-2">
                              <FlowStep active={!stage.sent} done={stage.sent} icon={stage.sent ? CheckCircle2 : CircleDashed} label="Registration" />
                              <FlowStep active={stage.sent && !stage.submitted} done={stage.submitted} icon={Send} label="Interview / Form Sent" />
                              <FlowStep active={stage.submitted && !stage.overdue} done={stage.submitted} icon={FileCheck2} label="Form Submitted" />
                              <FlowStep active={stage.overdue} done={!stage.overdue && stage.status === "sent"} icon={ClipboardList} label="Next Admission Step" />
                            </div>
                          );
                        })()}
                      </td>
                    ) : null}
                    <td className="px-5 py-5 text-sm text-[#245C4F]">{formatDate(item.created_at)}</td>
                    {showActionsColumn ? (
                      <td className="px-5 py-5 text-right">
                        {showDetailsButton ? (
                          <button
                            type="button"
                            onClick={() => {
                              setMessage("");
                              setSelectedLead(item);
                            }}
                            className="rounded-full bg-[#0D5C48] px-4 py-2 text-sm font-semibold text-[#FAF7F0] transition hover:bg-[#063F32] disabled:cursor-not-allowed disabled:opacity-70"
                            disabled={loadingId === item.id}
                          >
                            Details
                          </button>
                        ) : null}
                      </td>
                    ) : null}
                  </tr>
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
        {items.length > PAGE_SIZE ? (
          <div className="border-t border-[#2D8A6A]/10 bg-[#FAF7F0]/50 px-4 py-4">
            <PaginationControls
              page={currentPage}
              pageSize={PAGE_SIZE}
              totalItems={items.length}
              onPageChange={(nextPage) => setPage(Math.min(Math.max(1, nextPage), totalPages))}
            />
          </div>
        ) : null}
      </section>

      <div className="grid gap-4 min-[992px]:hidden">
        {visibleItems.map((item) => (
          <article
            key={item.id}
            className="rounded-[1.75rem] border border-[#2D8A6A]/15 bg-[linear-gradient(180deg,rgba(255,255,255,0.96)_0%,rgba(250,247,240,0.98)_100%)] p-5 shadow-[0_18px_60px_-36px_rgba(13,59,46,0.18)] backdrop-blur-xl"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-lg font-semibold text-[#063F32]">{textOrDash(item.student_name)}</p>
                <p className="mt-1 text-sm text-[#245C4F]">{textOrDash(item.class_level)}</p>
              </div>
              <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${admissionStatusTone(item.admission_form_status)}`}>
                {admissionStatusLabel(item.admission_form_status || item.status)}
              </span>
            </div>

            <dl className="mt-4 grid gap-3 text-sm text-[#245C4F] sm:grid-cols-2">
              <InfoCell label="Parent / Guardian" value={item.parent_name} />
              <InfoCell label="WhatsApp Number" value={item.phone} />
              <InfoCell label="Email Address" value={item.email} />
              <InfoCell label="Child Name" value={item.student_name} />
              <InfoCell label="Child Age" value={item.student_age} />
              <InfoCell label="Interested Level" value={item.class_level} />
              <InfoCell label="City / Country" value={item.city_country} />
              <InfoCell
                label="Message"
                value={
                  <button
                    type="button"
                    onClick={() => setSelectedMessage(item)}
                    className="text-left font-medium text-[#0D5C48] underline decoration-dotted underline-offset-4 transition hover:text-[#063F32]"
                  >
                    {truncate(item.message || item.notes, 80)}
                  </button>
                }
              />
              <InfoCell label="Form Status" value={admissionStatusLabel(item.admission_form_status || item.status)} />
            </dl>

            {showDetailsButton ? (
              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setMessage("");
                    setSelectedLead(item);
                  }}
                  className="rounded-full bg-[#0D5C48] px-4 py-2 text-sm font-semibold text-[#FAF7F0] transition hover:bg-[#063F32] disabled:cursor-not-allowed disabled:opacity-70"
                  disabled={loadingId === item.id}
                >
                  Details
                </button>
              </div>
            ) : null}
          </article>
        ))}
        {items.length > PAGE_SIZE ? (
          <div className="rounded-[1.5rem] border border-[#2D8A6A]/15 bg-[linear-gradient(180deg,rgba(255,255,255,0.96)_0%,rgba(250,247,240,0.98)_100%)] shadow-[0_18px_60px_-36px_rgba(13,59,46,0.18)] backdrop-blur-xl">
            <PaginationControls
              page={currentPage}
              pageSize={PAGE_SIZE}
              totalItems={items.length}
              onPageChange={(nextPage) => setPage(Math.min(Math.max(1, nextPage), totalPages))}
            />
          </div>
        ) : null}
      </div>

      {selectedLead && showDetailsButton ? (
        <ClientPortal targetId="coordinator-page-portal-root">
          <div className="absolute inset-x-0 top-0 z-[9999] isolate flex min-h-full items-start justify-center overflow-visible bg-[#063F32]/45 px-4 pb-10 pt-10">
            <div className="max-h-[90vh] w-full max-w-6xl overflow-y-auto rounded-[2rem] border border-[#2D8A6A]/15 bg-[#FAF7F0] p-6 shadow-[0_24px_80px_-36px_rgba(13,59,46,0.24)] sm:p-8">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold uppercase tracking-[0.24em] text-[#C9A227]">
                    Interested student details
                  </p>
                  <h2 className="mt-3 font-display text-2xl font-bold tracking-tight text-[#063F32]">
                    {textOrDash(selectedLead.student_name)}
                  </h2>
                  <p className="mt-2 text-sm text-[#245C4F]">
                    Send the admission form link and keep the registration record in one place.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedLead(null)}
                  className="rounded-xl border border-[#2D8A6A]/20 bg-[#FAF7F0] px-3 py-2 text-sm font-semibold text-[#063F32] transition hover:bg-[#F1EADC]"
                >
                  Close
                </button>
              </div>

              <div className="mt-6">
                <section className="rounded-[1.75rem] border border-[#2D8A6A]/15 bg-[linear-gradient(180deg,rgba(255,255,255,0.96)_0%,rgba(250,247,240,0.98)_100%)] p-5 shadow-[0_18px_60px_-36px_rgba(13,59,46,0.18)]">
                  <h3 className="text-lg font-semibold text-[#063F32]">Payment details</h3>
                  <p className="mt-2 text-sm text-[#245C4F]">
                    These are the same payment values the admission form will use in step 6.
                  </p>

                  <div className="mt-4 grid gap-4">
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="rounded-[1rem] border border-[#2D8A6A]/15 bg-white p-4">
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#0D5C48]">Admission fee</p>
                        <div className="mt-3 relative">
                          <select
                            value={previewAdmissionFeeId}
                            onChange={(event) => setPreviewAdmissionFeeId(event.target.value)}
                            className="w-full appearance-none rounded-2xl border border-[#2D8A6A]/20 bg-[#FAF7F0] px-4 py-3 pr-11 text-sm text-[#063F32] outline-none transition focus:border-[#2D8A6A] focus:bg-white focus:ring-4 focus:ring-[#FFF5D6]"
                          >
                            <option value="">No admission fee selected</option>
                            {paymentOptions.admissionFees.map((item) => (
                              <option key={item.id || item.title} value={item.id}>
                                {item.title || item.name || "Admission fee"} - PKR{" "}
                                {Number(item.amount || 0).toLocaleString("en-PK")}
                              </option>
                            ))}
                          </select>
                        </div>
                        <p className="mt-2 text-sm text-[#245C4F]">
                          {selectedPreviewAdmissionFee?.title ||
                            selectedPreviewAdmissionFee?.name ||
                            "Choose an admission-fee item from fee management."}
                        </p>
                      </div>

                      <div className="rounded-[1rem] border border-[#2D8A6A]/15 bg-white p-4">
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#0D5C48]">Discount</p>
                        <div className="mt-3 relative">
                          <select
                            value={previewDiscountId}
                            onChange={(event) => setPreviewDiscountId(event.target.value)}
                            className="w-full appearance-none rounded-2xl border border-[#2D8A6A]/20 bg-[#FAF7F0] px-4 py-3 pr-11 text-sm text-[#063F32] outline-none transition focus:border-[#2D8A6A] focus:bg-white focus:ring-4 focus:ring-[#FFF5D6]"
                          >
                            <option value="">No discount selected</option>
                            {paymentOptions.discounts
                              .filter(
                                (item) =>
                                  Number(item.percent || 0) <=
                                  Number(paymentOptions.coordinatorMaxDiscountPercent || 20)
                              )
                              .map((item) => (
                                <option key={item.id || item.label} value={item.id}>
                                  {item.label || `${Number(item.percent || 0)}%`}
                                </option>
                              ))}
                          </select>
                        </div>
                        <p className="mt-2 text-sm text-[#245C4F]">
                          Allowed discounts are limited to coordinator-approved values up to 20%.
                        </p>
                      </div>
                    </div>

                    <div className="rounded-[1rem] border border-[#2D8A6A]/10 bg-white p-4">
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#0D5C48]">
                        Payment instructions
                      </p>
                      <textarea
                        rows={4}
                        value={previewPaymentInstructions}
                        onChange={(event) => setPreviewPaymentInstructions(event.target.value)}
                        placeholder={selectedPreviewPaymentMethod?.instructions || "Add payment instructions for this admission"}
                        className="mt-3 w-full rounded-2xl border border-[#2D8A6A]/20 bg-[#FAF7F0] px-4 py-3 text-sm text-[#063F32] outline-none transition focus:border-[#2D8A6A] focus:bg-white focus:ring-4 focus:ring-[#FFF5D6]"
                      />
                      <p className="mt-2 text-sm text-[#245C4F]">
                        {previewPaymentInstructions || selectedPreviewPaymentMethod?.instructions || "No payment instructions added yet."}
                      </p>
                    </div>

                    <div className="rounded-[1rem] border border-[#2D8A6A]/10 bg-white p-4">
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#0D5C48]">Payment methods</p>
                      <div className="mt-3 grid gap-3">
                        {paymentOptions.paymentMethods.length ? (
                          paymentOptions.paymentMethods.map((method) => (
                            <div
                              key={method.id || method.name}
                              className="rounded-xl border border-[#2D8A6A]/10 bg-[#FAF7F0] px-3 py-2 text-sm text-[#063F32]"
                            >
                              <p className="font-semibold">{method.name || "Payment method"}</p>
                              <div className="mt-2 grid gap-1 text-xs text-[#245C4F]">
                                {method.bank_name ? (
                                  <p>
                                    <span className="font-semibold text-[#063F32]">Bank:</span> {method.bank_name}
                                  </p>
                                ) : null}
                                {method.account_title ? (
                                  <p>
                                    <span className="font-semibold text-[#063F32]">Account title:</span> {method.account_title}
                                  </p>
                                ) : null}
                                {method.account_number ? (
                                  <p>
                                    <span className="font-semibold text-[#063F32]">Account number:</span> {method.account_number}
                                  </p>
                                ) : null}
                                {method.iban ? (
                                  <p>
                                    <span className="font-semibold text-[#063F32]">IBAN:</span> {method.iban}
                                  </p>
                                ) : null}
                                {method.branch_code ? (
                                  <p>
                                    <span className="font-semibold text-[#063F32]">Branch code:</span> {method.branch_code}
                                  </p>
                                ) : null}
                                {method.instructions ? (
                                  <p>
                                    <span className="font-semibold text-[#063F32]">Instructions:</span> {method.instructions}
                                  </p>
                                ) : null}
                              </div>
                            </div>
                          ))
                        ) : (
                          <p className="text-sm text-[#245C4F]">No payment methods available.</p>
                        )}
                      </div>
                    </div>

                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="rounded-[1rem] border border-[#2D8A6A]/15 bg-white p-4">
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#0D5C48]">Regular fee</p>
                        <p className="mt-3 text-2xl font-bold text-[#063F32]">
                          {regularFee ? `PKR ${regularFeeAmount.toLocaleString("en-PK")}` : "No regular fee selected"}
                        </p>
                        <p className="mt-2 text-sm text-[#245C4F]">
                          {regularFee?.title || regularFee?.name || `Based on ${selectedClassLevel || "the selected class"}.`}
                        </p>
                      </div>
                      <div className="rounded-[1rem] border border-[#2D8A6A]/10 bg-white p-4 text-sm text-[#245C4F]">
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#0D5C48]">Discount amount</p>
                        <p className="mt-2 text-lg font-bold text-[#063F32]">PKR {discountAmount.toLocaleString("en-PK")}</p>
                        <p className="mt-1">Applied on the regular fee only.</p>
                      </div>
                      <div className="rounded-[1rem] border border-[#2D8A6A]/10 bg-white p-4 text-sm text-[#245C4F]">
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#0D5C48]">
                          Total after discount
                        </p>
                        <p className="mt-2 text-lg font-bold text-[#063F32]">PKR {totalAmount.toLocaleString("en-PK")}</p>
                        <p className="mt-1">Regular fee minus discount plus admission fee.</p>
                      </div>
                    </div>

                    <div className="mt-5 flex flex-wrap justify-end gap-3">
                      <button
                        type="button"
                        onClick={() => setSelectedLead(null)}
                        className="rounded-full border border-[#2D8A6A]/20 bg-[#FAF7F0] px-4 py-2 text-sm font-semibold text-[#063F32] transition hover:bg-[#F1EADC]"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={async () => {
                          await sendAdmissionForm(selectedLead);
                          setSelectedLead(null);
                        }}
                        disabled={loadingId === selectedLead.id}
                        className="rounded-full bg-[#0D5C48] px-4 py-2 text-sm font-semibold text-[#FAF7F0] transition hover:bg-[#063F32] disabled:cursor-not-allowed disabled:opacity-70"
                      >
                        {loadingId === selectedLead.id ? "Sending..." : "Send Form"}
                      </button>
                    </div>
                  </div>
                </section>
              </div>
            </div>
          </div>
        </ClientPortal>
      ) : null}

    </>
  );
}
