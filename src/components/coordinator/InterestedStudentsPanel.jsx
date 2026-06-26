"use client";

import { useMemo, useState } from "react";

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
    return <section className="rounded-[1.75rem] border border-dashed border-slate-300 bg-white/85 p-10 text-center text-sm text-slate-500 shadow-[0_18px_60px_-36px_rgba(15,23,42,0.18)]">No interested students found.</section>;
  }

  return (
    <>
      <section className="overflow-hidden rounded-[1.75rem] border border-white/70 bg-white/90 shadow-[0_20px_70px_-36px_rgba(15,23,42,0.25)]">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50/80">
              <tr className="text-left text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                <th className="px-6 py-4">Student Name</th>
                <th className="px-6 py-4">Parent Name</th>
                <th className="px-6 py-4">Email</th>
                <th className="px-6 py-4">Phone</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4">Created At</th>
                <th className="px-6 py-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {items.map((item) => (
                <tr key={item.id} className="align-top">
                  <td className="px-6 py-5 font-semibold text-slate-950">{item.student_name || "-"}</td>
                  <td className="px-6 py-5 text-slate-700">{item.parent_name || "-"}</td>
                  <td className="px-6 py-5 text-slate-700">{item.email || "-"}</td>
                  <td className="px-6 py-5 text-slate-700">{item.phone || "-"}</td>
                  <td className="px-6 py-5">
                    <span className="inline-flex rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">{statusLabel(item.status)}</span>
                  </td>
                  <td className="px-6 py-5 text-sm text-slate-600">{formatDate(item.created_at)}</td>
                  <td className="px-6 py-5 text-right">
                    <button
                      type="button"
                      onClick={() => {
                        setSelected(item);
                        setLink(item.registration_link || "");
                        setMessage("");
                      }}
                      className="rounded-full bg-slate-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800"
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
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-hidden bg-slate-950/50 px-4 pt-28 pb-10">
          <div className="w-full max-w-2xl max-h-[calc(100vh-6.5rem)] overflow-y-auto rounded-[2rem] bg-white p-6 shadow-[0_24px_80px_-32px_rgba(15,23,42,0.35)]">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.24em] text-sky-700">Interested student</p>
                <h3 className="mt-2 text-2xl font-semibold text-slate-950">{selected.student_name || "-"}</h3>
              </div>
              <button type="button" onClick={() => setSelected(null)} className="rounded-full bg-slate-100 px-3 py-2 text-sm font-semibold text-slate-700">
                Close
              </button>
            </div>

            <dl className="mt-6 grid gap-4 text-sm sm:grid-cols-2">
              <div><dt className="text-slate-500">Parent Name</dt><dd className="mt-1 font-medium text-slate-900">{selected.parent_name || "-"}</dd></div>
              <div><dt className="text-slate-500">Email</dt><dd className="mt-1 font-medium text-slate-900">{selected.email || "-"}</dd></div>
              <div><dt className="text-slate-500">Phone</dt><dd className="mt-1 font-medium text-slate-900">{selected.phone || "-"}</dd></div>
              <div><dt className="text-slate-500">Status</dt><dd className="mt-1 font-medium text-slate-900">{statusLabel(selected.status)}</dd></div>
              <div><dt className="text-slate-500">Created At</dt><dd className="mt-1 font-medium text-slate-900">{formatDate(selected.created_at)}</dd></div>
              <div>
                <dt className="flex items-center justify-between gap-3 text-slate-500">
                  <span>Registration Link</span>
                  {selectedLink ? (
                    <button
                      type="button"
                      onClick={() => void copyLink()}
                      className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 transition hover:bg-slate-100"
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
                <dd className="mt-1 break-all font-medium text-slate-900">{selectedLink || "Not generated yet."}</dd>
              </div>
            </dl>

            {linkMessage ? (
              <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-700">
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <p className="font-semibold text-slate-950">Registration message</p>
                    <p className="whitespace-pre-wrap leading-7">{linkMessage}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => void copyLinkMessage()}
                    className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-100"
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

            {message ? <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">{message}</div> : null}

            <div className="mt-6 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => void generateLink(selected)}
                disabled={loadingId === selected.id}
                className="rounded-full bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {loadingId === selected.id ? "Generating..." : selected.registration_token ? "Generate Registration Message" : "Generate Registration Message"}
              </button>
              {selectedLink ? null : null}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
