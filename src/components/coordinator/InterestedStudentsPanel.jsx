"use client";

import { useMemo, useState } from "react";
import ClientPortal from "@/components/shared/ClientPortal";

function formatDate(value) {
  if (!value) return "No date";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Invalid date";
  return new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

function statusLabel(value) {
  return String(value || "")
    .split("_")
    .filter(Boolean)
    .map((part) => part[0].toUpperCase() + part.slice(1))
    .join(" ");
}

export default function InterestedStudentsPanel({ items = [], onRefresh }) {
  const [selected, setSelected] = useState(null);
  const [loadingId, setLoadingId] = useState("");
  const [link, setLink] = useState("");
  const [message, setMessage] = useState("");
  const [linkMessage, setLinkMessage] = useState("");

  const selectedLink = useMemo(() => selected?.registration_link || link || "", [selected, link]);

  function buildLinkMessage(item, registrationLink) {
    const studentName = item?.student_name || "Student";
    const parentName = item?.parent_name || "Parent";
    return [
      "Assalamualaikum,",
      "",
      "Interested student details:",
      `Student: ${studentName}`,
      `Parent: ${parentName}`,
      `Email: ${item?.email || "-"}`,
      `Phone: ${item?.phone || "-"}`,
      "",
      "Registration Link:",
      registrationLink,
    ].join("\n");
  }

  async function generateLink(item) {
    setLoadingId(item.id);
    setMessage("");
    try {
      const response = await fetch(`/api/coordinator/interested-students/${encodeURIComponent(item.id)}/registration-link`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const data = await response.json();
      if (!response.ok || !data?.success) {
        throw new Error(data?.message || "Unable to generate registration message.");
      }

      setSelected((current) => ({
        ...(current || item),
        registration_link: data.registration_link,
        registration_token: current?.registration_token || item.registration_token || "",
        status: data.already_generated ? current?.status || item.status : "link_generated",
      }));
      setLink(data.registration_link || "");
      setLinkMessage(buildLinkMessage(item, data.registration_link || ""));
      setMessage(data.already_generated ? "Existing registration message and link loaded." : "Registration message and link generated.");
      await onRefresh?.();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to generate registration message.");
    } finally {
      setLoadingId("");
    }
  }

  async function copyLink() {
    if (!selectedLink) return;
    await navigator.clipboard.writeText(selectedLink);
    setMessage("Registration link copied.");
  }

  async function copyLinkMessage() {
    if (!linkMessage) return;
    await navigator.clipboard.writeText(linkMessage);
    setMessage("Registration message copied.");
  }

  if (!items.length) {
    return <section className="rounded-[1.75rem] border border-dashed border-[#2D8A6A]/25 bg-[#FAF7F0]/80 p-10 text-center text-sm text-[#245C4F] shadow-[0_18px_60px_-36px_rgba(13,59,46,0.18)]">No interested students found.</section>;
  }

  return (
    <>
      <section className="overflow-hidden rounded-[2rem] border border-[#2D8A6A]/15 bg-[linear-gradient(180deg,rgba(255,255,255,0.96)_0%,rgba(250,247,240,0.98)_100%)] shadow-[0_20px_70px_-36px_rgba(13,59,46,0.18)] backdrop-blur-xl">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-[#F1EADC]">
            <thead className="bg-[linear-gradient(180deg,#FAF7F0_0%,#F1EADC_100%)]">
              <tr className="text-left text-xs font-semibold uppercase tracking-[0.18em] text-[#0D5C48]">
                <th className="px-6 py-4">Student Name</th>
                <th className="px-6 py-4">Parent Name</th>
                <th className="px-6 py-4">Email</th>
                <th className="px-6 py-4">Phone</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4">Created At</th>
                <th className="px-6 py-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F1EADC]">
              {items.map((item) => (
                <tr key={item.id} className="align-top">
                  <td className="px-5 py-5 font-semibold text-[#063F32]">{item.student_name || "-"}</td>
                  <td className="px-5 py-5 text-[#245C4F]">{item.parent_name || "-"}</td>
                  <td className="px-5 py-5 text-[#245C4F]">{item.email || "-"}</td>
                  <td className="px-5 py-5 text-[#245C4F]">{item.phone || "-"}</td>
                  <td className="px-5 py-5">
                    <span className="inline-flex rounded-full bg-[#EAF6EF] px-3 py-1 text-xs font-semibold text-[#0D5C48]">{statusLabel(item.status)}</span>
                  </td>
                  <td className="px-5 py-5 text-sm text-[#245C4F]">{formatDate(item.created_at)}</td>
                  <td className="px-5 py-5 text-right">
                    <button
                      type="button"
                      onClick={() => {
                        setSelected(item);
                        setLink(item.registration_link || "");
                        setMessage("");
                      }}
                      className="rounded-full bg-[#0D5C48] px-4 py-2 text-sm font-semibold text-[#FAF7F0] transition hover:bg-[#063F32]"
                    >
                      Details
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {selected ? (
        <ClientPortal targetId="coordinator-page-portal-root">
        <div className="absolute inset-x-0 top-0 z-[9999] isolate flex min-h-full items-start justify-center overflow-visible bg-[#063F32]/45 px-4 pt-10 pb-10">
          <div className="w-full max-w-2xl rounded-[2rem] border border-[#2D8A6A]/15 bg-[#FAF7F0] p-6 shadow-[0_24px_80px_-32px_rgba(13,59,46,0.24)]">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.24em] text-[#C9A227]">Interested student</p>
                <h3 className="mt-2 text-2xl font-semibold text-[#063F32]">{selected.student_name || "-"}</h3>
              </div>
              <button type="button" onClick={() => setSelected(null)} className="rounded-full border border-[#2D8A6A]/20 bg-white px-3 py-2 text-sm font-semibold text-[#063F32] transition hover:bg-[#F1EADC]">
                Close
              </button>
            </div>

            <dl className="mt-6 grid gap-4 text-sm sm:grid-cols-2">
              <div><dt className="text-[#245C4F]">Parent Name</dt><dd className="mt-1 font-medium text-[#063F32]">{selected.parent_name || "-"}</dd></div>
              <div><dt className="text-[#245C4F]">Email</dt><dd className="mt-1 font-medium text-[#063F32]">{selected.email || "-"}</dd></div>
              <div><dt className="text-[#245C4F]">Phone</dt><dd className="mt-1 font-medium text-[#063F32]">{selected.phone || "-"}</dd></div>
              <div><dt className="text-[#245C4F]">Status</dt><dd className="mt-1 font-medium text-[#063F32]">{statusLabel(selected.status)}</dd></div>
              <div><dt className="text-[#245C4F]">Created At</dt><dd className="mt-1 font-medium text-[#063F32]">{formatDate(selected.created_at)}</dd></div>
              <div>
                <dt className="flex items-center justify-between gap-3 text-[#245C4F]">
                  <span>Registration Link</span>
                  {selectedLink ? (
                    <button
                      type="button"
                      onClick={() => void copyLink()}
                      className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-[#2D8A6A]/20 bg-white text-[#063F32] transition hover:bg-[#F1EADC]"
                      aria-label="Copy registration link"
                      title="Copy registration link"
                    >
                      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="9" y="9" width="11" height="11" rx="2" />
                        <path d="M5 15V5a2 2 0 0 1 2-2h10" />
                      </svg>
                    </button>
                  ) : null}
                </dt>
                <dd className="mt-1 break-all font-medium text-[#063F32]">{selectedLink || "Not generated yet."}</dd>
              </div>
            </dl>

            {linkMessage ? (
              <div className="mt-5 rounded-2xl border border-[#2D8A6A]/15 bg-[linear-gradient(180deg,rgba(255,255,255,0.96)_0%,rgba(250,247,240,0.98)_100%)] px-4 py-4 text-sm text-[#245C4F]">
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <p className="font-semibold text-[#063F32]">Registration message</p>
                    <p className="whitespace-pre-wrap leading-7">{linkMessage}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => void copyLinkMessage()}
                    className="inline-flex items-center gap-2 rounded-full border border-[#2D8A6A]/20 bg-white px-3 py-2 text-xs font-semibold text-[#063F32] transition hover:bg-[#F1EADC]"
                  >
                    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="9" y="9" width="11" height="11" rx="2" />
                      <path d="M5 15V5a2 2 0 0 1 2-2h10" />
                    </svg>
                    Copy
                  </button>
                </div>
              </div>
            ) : null}

            {message ? <div className="mt-5 rounded-2xl border border-[#2D8A6A]/15 bg-[#FAF7F0] px-4 py-3 text-sm text-[#245C4F]">{message}</div> : null}

            <div className="mt-6 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => void generateLink(selected)}
                disabled={loadingId === selected.id}
                className="rounded-full bg-[#0D5C48] px-4 py-2.5 text-sm font-semibold text-[#FAF7F0] transition hover:bg-[#063F32] disabled:cursor-not-allowed disabled:opacity-70"
              >
                {loadingId === selected.id ? "Generating..." : selected.registration_token ? "Generate Registration Message" : "Generate Registration Message"}
              </button>
              {selectedLink ? null : null}
            </div>
          </div>
        </div>
        </ClientPortal>
      ) : null}
    </>
  );
}
