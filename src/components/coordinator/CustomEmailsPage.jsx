"use client";

import { useEffect, useMemo, useState } from "react";
import { ImagePlus, Mail, Plus, Search, Send, X } from "lucide-react";
import ClientPortal from "@/components/shared/ClientPortal";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const RECIPIENT_BATCH_SIZE = 9;

function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

function uniqueEmails(values) {
  const seen = new Set();
  return values
    .map(normalizeEmail)
    .filter((email) => {
      if (!EMAIL_PATTERN.test(email) || email.endsWith(".local") || email.startsWith("no-email-") || seen.has(email)) return false;
      seen.add(email);
      return true;
    });
}

export default function CustomEmailsPage({
  portalLabel = "Coordinator portal",
  title = "Custom Emails",
  description = "Send a themed LMS email to selected event registrations and verified LMS users.",
  portalTargetId = "coordinator-page-portal-root",
}) {
  const [recipients, setRecipients] = useState([]);
  const [loadingRecipients, setLoadingRecipients] = useState(true);
  const [recipientError, setRecipientError] = useState("");
  const [open, setOpen] = useState(false);
  const [subject, setSubject] = useState("");
  const [intro, setIntro] = useState("");
  const [body, setBody] = useState("");
  const [emailInput, setEmailInput] = useState("");
  const [selectedEmails, setSelectedEmails] = useState([]);
  const [imageFile, setImageFile] = useState(null);
  const [search, setSearch] = useState("");
  const [visibleRecipientCount, setVisibleRecipientCount] = useState(RECIPIENT_BATCH_SIZE);
  const [modalVisibleRecipientCount, setModalVisibleRecipientCount] = useState(RECIPIENT_BATCH_SIZE);
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState("");
  const [tone, setTone] = useState("success");
  const [errors, setErrors] = useState({});

  async function loadRecipients() {
    setLoadingRecipients(true);
    setRecipientError("");
    try {
      const response = await fetch("/api/coordinator/custom-emails", { cache: "no-store" });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data?.message || "Unable to load receiver emails.");
      setRecipients(
        Array.isArray(data.recipients)
          ? data.recipients.filter((recipient) => uniqueEmails([recipient.email]).length)
          : []
      );
    } catch (error) {
      setRecipientError(error instanceof Error ? error.message : "Unable to load receiver emails.");
      setRecipients([]);
    } finally {
      setLoadingRecipients(false);
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadRecipients();
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!message) return undefined;
    const timer = window.setTimeout(() => setMessage(""), 3500);
    return () => window.clearTimeout(timer);
  }, [message]);

  const selectedSet = useMemo(() => new Set(selectedEmails.map(normalizeEmail)), [selectedEmails]);

  const filteredRecipients = useMemo(() => {
    const term = search.trim().toLowerCase();
    return recipients.filter((recipient) => {
      const email = normalizeEmail(recipient.email);
      if (selectedSet.has(email)) return false;
      if (!term) return true;
      return [
        recipient.email,
        recipient.name,
        recipient.source_label,
      ].some((value) => String(value || "").toLowerCase().includes(term));
    });
  }, [recipients, search, selectedSet]);

  const visibleRecipients = useMemo(
    () => recipients.slice(0, visibleRecipientCount),
    [recipients, visibleRecipientCount]
  );
  const modalVisibleRecipients = useMemo(
    () => filteredRecipients.slice(0, modalVisibleRecipientCount),
    [filteredRecipients, modalVisibleRecipientCount]
  );

  function resetForm() {
    setSubject("");
    setIntro("");
    setBody("");
    setEmailInput("");
    setSelectedEmails([]);
    setImageFile(null);
    setSearch("");
    setErrors({});
  }

  function openComposer() {
    setOpen(true);
    setErrors({});
  }

  function closeComposer() {
    if (sending) return;
    setOpen(false);
    resetForm();
  }

  function addEmails(values) {
    const nextEmails = uniqueEmails(Array.isArray(values) ? values : String(values || "").split(/[,\s]+/));
    if (!nextEmails.length) return;
    setSelectedEmails((current) => uniqueEmails([...current, ...nextEmails]));
    setEmailInput("");
    setErrors((current) => ({ ...current, receivers: "" }));
  }

  function removeEmail(email) {
    const normalized = normalizeEmail(email);
    setSelectedEmails((current) => current.filter((item) => normalizeEmail(item) !== normalized));
  }

  function validateForm() {
    const nextErrors = {};
    if (!subject.trim()) nextErrors.subject = "Subject is required.";
    if (!body.trim()) nextErrors.body = "Body is required.";
    if (!selectedEmails.length) nextErrors.receivers = "Select or write at least one receiver email.";
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }

  async function sendEmails() {
    if (!validateForm()) return;
    setSending(true);
    setMessage("");
    try {
      const response = await fetch("/api/coordinator/custom-emails", {
        method: "POST",
        body: (() => {
          const formData = new FormData();
          formData.append("subject", subject.trim());
          formData.append("intro", intro.trim());
          formData.append("body", body.trim());
          formData.append("recipients", JSON.stringify(selectedEmails));
          if (imageFile) formData.append("image", imageFile);
          return formData;
        })(),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data?.message || "Unable to send emails.");
      setTone("success");
      setMessage(data?.message || "Emails sent successfully.");
      closeComposer();
    } catch (error) {
      setTone("error");
      setMessage(error instanceof Error ? error.message : "Unable to send emails.");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#FAF7F0]">
      <div className="relative mx-auto max-w-7xl space-y-6 px-4 py-4 sm:px-6 lg:px-8">
        {message ? (
          <div className={`fixed right-4 top-4 z-[10000] rounded-2xl border px-4 py-3 text-sm font-semibold shadow-[0_18px_40px_-24px_rgba(13,59,46,0.45)] ${tone === "success" ? "border-[#2D8A6A]/25 bg-[linear-gradient(135deg,#0D3B2E,#0D5C48)] text-[#FFF5D6]" : "border-rose-200 bg-white text-rose-700"}`}>
            {message}
          </div>
        ) : null}

        <section className="relative overflow-hidden rounded-[2rem] border border-[#2D8A6A]/15 bg-[linear-gradient(135deg,rgba(13,59,46,0.98),rgba(13,92,72,0.94))] p-6 text-[#FAF7F0] shadow-[0_24px_80px_-36px_rgba(13,59,46,0.32)] sm:p-8">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="inline-flex rounded-full border border-[#E4C766]/30 bg-[#FFF5D6]/12 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-[#FFF5D6]">
                {portalLabel}
              </p>
              <h1 className="mt-4 font-display text-3xl font-bold tracking-tight sm:text-4xl">{title}</h1>
              <p className="mt-3 max-w-3xl text-sm leading-7 text-[#EAF6EF] sm:text-base">{description}</p>
            </div>
            <button
              type="button"
              onClick={openComposer}
              className="inline-flex items-center justify-center gap-2 rounded-full border border-[#E4C766]/40 bg-[#FFF5D6] px-5 py-3 text-sm font-bold text-[#063F32] shadow-[0_18px_40px_-24px_rgba(0,0,0,0.45)] transition hover:-translate-y-0.5 hover:bg-white"
            >
              <Send className="h-4 w-4" />
              Send Emails
            </button>
          </div>
        </section>

        <section className="rounded-[2rem] border border-[#2D8A6A]/15 bg-white p-5 shadow-[0_18px_60px_-40px_rgba(13,59,46,0.25)] sm:p-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.24em] text-[#C79A3B]">Receiver Emails</p>
              <h2 className="mt-2 text-2xl font-bold text-[#063F32]">Available recipient list</h2>
              <p className="mt-2 text-sm leading-6 text-[#245C4F]">
                Choose email addresses from event registrations and active LMS accounts.
              </p>
            </div>
            <div className="rounded-2xl border border-[#2D8A6A]/15 bg-[#FAF7F0] px-4 py-3 text-sm font-bold text-[#063F32]">
              {loadingRecipients ? "Loading..." : `${recipients.length} emails available`}
            </div>
          </div>

          {recipientError ? (
            <div className="mt-5 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">
              {recipientError}
            </div>
          ) : null}

          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {loadingRecipients ? Array.from({ length: 6 }, (_, index) => (
              <div key={index} className="h-20 animate-pulse rounded-2xl bg-[#F1EADC]" />
            )) : visibleRecipients.map((recipient) => (
              <div key={recipient.email} className="rounded-2xl border border-[#2D8A6A]/15 bg-[#FAF7F0] p-4">
                <p className="truncate text-sm font-bold text-[#063F32]">{recipient.email}</p>
                <p className="mt-1 truncate text-xs font-semibold text-[#2D8A6A]">{recipient.source_label}</p>
              </div>
            ))}
          </div>
          {!loadingRecipients && recipients.length > visibleRecipientCount ? (
            <button
              type="button"
              onClick={() => setVisibleRecipientCount((current) => current + RECIPIENT_BATCH_SIZE)}
              className="mt-5 rounded-full border border-[#2D8A6A]/20 bg-white px-5 py-3 text-sm font-bold text-[#063F32] transition hover:bg-[#FFF5D6]"
            >
              Show more emails
            </button>
          ) : null}
        </section>

        {open ? (
          <ClientPortal targetId={portalTargetId}>
            <div className="absolute inset-0 z-[10000] flex min-h-full w-full items-start justify-center overflow-hidden bg-[#063F32]/55 px-3 py-6 backdrop-blur-sm sm:px-4 sm:py-10">
              <div className="flex max-h-[calc(100dvh-3rem)] w-full max-w-4xl min-w-0 flex-col overflow-hidden rounded-[2rem] border border-[#2D8A6A]/15 bg-[#FAF7F0] shadow-[0_30px_90px_-36px_rgba(13,59,46,0.55)] sm:max-h-[calc(100dvh-5rem)]">
                <div className="flex items-start justify-between gap-4 border-b border-[#2D8A6A]/10 px-5 py-5 sm:px-6">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.24em] text-[#C79A3B]">Custom Email</p>
                    <h2 className="mt-2 text-2xl font-bold text-[#063F32]">Send Emails</h2>
                    <p className="mt-1 text-sm text-[#245C4F]">Write emails manually or select from the receiver list.</p>
                  </div>
                  <button
                    type="button"
                    onClick={closeComposer}
                    className="rounded-xl border border-[#2D8A6A]/20 bg-white px-3 py-2 text-sm font-semibold text-[#063F32] transition hover:bg-[#F1EADC]"
                  >
                    Close
                  </button>
                </div>

                <div className="min-h-0 flex-1 overflow-y-auto p-5 sm:p-6">
                  <div className="grid min-w-0 gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(280px,0.85fr)]">
                    <div className="min-w-0 space-y-4">
                      <label className="block">
                        <span className="mb-2 block text-sm font-semibold text-[#245C4F]">Subject</span>
                        <input
                          value={subject}
                          onChange={(event) => {
                            setSubject(event.target.value);
                            setErrors((current) => ({ ...current, subject: "" }));
                          }}
                          placeholder="Enter email subject"
                          className="w-full rounded-2xl border border-[#2D8A6A]/20 bg-white px-4 py-3 text-sm font-semibold text-[#063F32] outline-none transition focus:border-[#2D8A6A] focus:ring-4 focus:ring-[#FFF5D6]"
                        />
                        {errors.subject ? <p className="mt-2 text-sm font-semibold text-rose-700">{errors.subject}</p> : null}
                      </label>

                      <label className="block">
                        <span className="mb-2 block text-sm font-semibold text-[#245C4F]">Intro</span>
                        <textarea
                          value={intro}
                          onChange={(event) => setIntro(event.target.value)}
                          rows={1}
                          placeholder="Short introduction shown below the email title"
                          className="w-full resize-none rounded-2xl border border-[#2D8A6A]/20 bg-white px-4 py-3 text-sm font-medium leading-6 text-[#063F32] outline-none transition focus:border-[#2D8A6A] focus:ring-4 focus:ring-[#FFF5D6]"
                        />
                      </label>

                      <label className="block">
                        <span className="mb-2 block text-sm font-semibold text-[#245C4F]">Body</span>
                        <textarea
                          value={body}
                          onChange={(event) => {
                            setBody(event.target.value);
                            setErrors((current) => ({ ...current, body: "" }));
                          }}
                          rows={8}
                          placeholder="Write your email message"
                          className="w-full resize-none rounded-2xl border border-[#2D8A6A]/20 bg-white px-4 py-3 text-sm font-medium leading-6 text-[#063F32] outline-none transition focus:border-[#2D8A6A] focus:ring-4 focus:ring-[#FFF5D6]"
                        />
                        {errors.body ? <p className="mt-2 text-sm font-semibold text-rose-700">{errors.body}</p> : null}
                      </label>

                      <label className="block rounded-2xl border border-[#2D8A6A]/15 bg-white p-4">
                        <span className="mb-2 flex items-center gap-2 text-sm font-semibold text-[#245C4F]">
                          <ImagePlus className="h-4 w-4 text-[#C79A3B]" />
                          Attached Image
                        </span>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={(event) => setImageFile(event.target.files?.[0] || null)}
                          className="w-full rounded-2xl border border-[#2D8A6A]/20 bg-[#FAF7F0] px-4 py-3 text-sm text-[#063F32] file:mr-4 file:rounded-xl file:border-0 file:bg-[#EAF6EF] file:px-4 file:py-2 file:text-sm file:font-semibold file:text-[#0D5C48]"
                        />
                        <p className="mt-2 break-words text-xs font-semibold text-[#245C4F]">
                          {imageFile?.name ? `Selected image: ${imageFile.name}` : "Optional image for this email."}
                        </p>
                      </label>

                      <div>
                        <span className="mb-2 block text-sm font-semibold text-[#245C4F]">Receiver Emails</span>
                        <div className="flex flex-col gap-2 rounded-2xl border border-[#2D8A6A]/20 bg-white p-2 sm:flex-row">
                          <input
                            value={emailInput}
                            onChange={(event) => setEmailInput(event.target.value)}
                            onKeyDown={(event) => {
                              if (event.key === "Enter") {
                                event.preventDefault();
                                addEmails(emailInput);
                              }
                            }}
                            placeholder="Write email, then press Add"
                            className="min-w-0 flex-1 rounded-xl bg-[#FAF7F0] px-4 py-3 text-sm font-semibold text-[#063F32] outline-none"
                          />
                          <button
                            type="button"
                            onClick={() => addEmails(emailInput)}
                            className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#0D5C48] px-4 py-3 text-sm font-bold text-[#FFF5D6]"
                          >
                            <Plus className="h-4 w-4" />
                            Add
                          </button>
                        </div>
                        {errors.receivers ? <p className="mt-2 text-sm font-semibold text-rose-700">{errors.receivers}</p> : null}
                      </div>

                      {selectedEmails.length ? (
                        <div className="flex flex-wrap gap-2">
                          {selectedEmails.map((email) => (
                            <span key={email} className="inline-flex max-w-full min-w-0 items-center gap-2 rounded-full border border-[#2D8A6A]/15 bg-[#EAF6EF] px-3 py-2 text-xs font-bold text-[#063F32]">
                              <span className="min-w-0 truncate">{email}</span>
                              <button type="button" onClick={() => removeEmail(email)} aria-label={`Remove ${email}`}>
                                <X className="h-3.5 w-3.5" />
                              </button>
                            </span>
                          ))}
                        </div>
                      ) : null}
                    </div>

                    <div className="min-w-0 rounded-[1.5rem] border border-[#2D8A6A]/15 bg-white p-4">
                      <div className="flex items-center gap-2 rounded-2xl border border-[#2D8A6A]/15 bg-[#FAF7F0] px-3 py-2">
                        <Search className="h-4 w-4 text-[#2D8A6A]" />
                        <input
                          value={search}
                          onChange={(event) => {
                            setSearch(event.target.value);
                            setModalVisibleRecipientCount(RECIPIENT_BATCH_SIZE);
                          }}
                          placeholder="Search receiver emails"
                          className="min-w-0 flex-1 bg-transparent text-sm font-semibold text-[#063F32] outline-none placeholder:text-[#7BA99C]"
                        />
                      </div>
                      <div className="mt-4 max-h-[38rem] space-y-2 overflow-y-auto pr-1">
                        {loadingRecipients ? (
                          <p className="rounded-2xl bg-[#FAF7F0] px-4 py-3 text-sm font-semibold text-[#245C4F]">Loading receiver emails...</p>
                        ) : filteredRecipients.length ? modalVisibleRecipients.map((recipient) => (
                          <button
                            key={recipient.email}
                            type="button"
                            onClick={() => addEmails([recipient.email])}
                            className="flex w-full items-center gap-3 rounded-2xl border border-[#2D8A6A]/10 bg-[#FAF7F0] px-4 py-3 text-left transition hover:border-[#C79A3B]/60 hover:bg-[#FFF5D6]"
                          >
                            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#0D5C48] text-[#FFF5D6]">
                              <Mail className="h-4 w-4" />
                            </span>
                            <span className="min-w-0">
                              <span className="block truncate text-sm font-bold text-[#063F32]">{recipient.email}</span>
                              <span className="block truncate text-xs font-semibold text-[#2D8A6A]">{recipient.source_label}</span>
                            </span>
                          </button>
                        )) : (
                          <p className="rounded-2xl bg-[#FAF7F0] px-4 py-3 text-sm font-semibold text-[#245C4F]">No receiver emails found.</p>
                        )}
                      </div>
                      {!loadingRecipients && filteredRecipients.length > modalVisibleRecipientCount ? (
                        <button
                          type="button"
                          onClick={() => setModalVisibleRecipientCount((current) => current + RECIPIENT_BATCH_SIZE)}
                          className="mt-4 w-full rounded-full border border-[#2D8A6A]/20 bg-white px-4 py-3 text-sm font-bold text-[#063F32] transition hover:bg-[#FFF5D6]"
                        >
                          Show more emails
                        </button>
                      ) : null}
                    </div>
                  </div>
                </div>

                <div className="flex flex-col gap-3 border-t border-[#2D8A6A]/10 px-5 py-4 sm:flex-row sm:justify-end sm:px-6">
                  <button
                    type="button"
                    onClick={closeComposer}
                    disabled={sending}
                    className="rounded-full border border-[#2D8A6A]/20 bg-white px-5 py-3 text-sm font-bold text-[#063F32] disabled:opacity-60"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={sendEmails}
                    disabled={sending}
                    className="inline-flex items-center justify-center gap-2 rounded-full bg-[#0D5C48] px-5 py-3 text-sm font-bold text-[#FFF5D6] shadow-[0_16px_36px_-24px_rgba(13,59,46,0.7)] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <Send className="h-4 w-4" />
                    {sending ? "Sending..." : "Send"}
                  </button>
                </div>
              </div>
            </div>
          </ClientPortal>
        ) : null}
      </div>
    </div>
  );
}
