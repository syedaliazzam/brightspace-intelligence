"use client";

import { useEffect, useMemo, useState } from "react";
import { ExternalLink, Download } from "lucide-react";
import { OpenBookLoader } from "@/components/shared/AshShajrahLoaders";
import AdminDataTable from "@/components/admin/AdminDataTable";

function formatDate(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

export default function CareerApplicationsPanel() {
  const [state, setState] = useState({ loading: true, error: "", items: [] });
  const [selectedMessage, setSelectedMessage] = useState(null);

  useEffect(() => {
    let active = true;

    async function load() {
      setState((current) => ({ ...current, loading: true, error: "" }));
      try {
        const response = await fetch("/api/admin/career-applications", { cache: "no-store" });
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data?.message || "Unable to load career applications.");
        }

        if (active) {
          setState({ loading: false, error: "", items: Array.isArray(data.items) ? data.items : [] });
        }
      } catch (error) {
        if (active) {
          setState({
            loading: false,
            error: error instanceof Error ? error.message : "Unable to load career applications.",
            items: [],
          });
        }
      }
    }

    void load();

    return () => {
      active = false;
    };
  }, []);

  const columns = useMemo(
    () => [
      { key: "full_name", label: "Full Name" },
      { key: "email", label: "Email" },
      { key: "whatsapp", label: "WhatsApp" },
      { key: "interested_role", label: "Interested Role" },
      {
        key: "message",
        label: "Message",
        render: (row) => (
          <button
            type="button"
            onClick={() => setSelectedMessage((current) => (current?.id === row.id ? null : row))}
            className="max-w-[20rem] text-left font-medium text-[#0D5C48] underline decoration-dotted underline-offset-4 transition hover:text-[#063F32]"
          >
            {(row.message || "-").length > 64 ? `${row.message.slice(0, 61)}...` : row.message || "-"}
          </button>
        ),
      },
      { key: "source", label: "Source" },
      { key: "submitted_at", label: "Submitted At", render: (row) => formatDate(row.submitted_at) },
    ],
    []
  );

  return (
    <div className="space-y-4">
      {state.error ? (
        <section className="rounded-[1.75rem] border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
          {state.error}
        </section>
      ) : null}
      {state.loading ? (
        <section className="rounded-[1.75rem] border border-[#2D8A6A]/15 bg-[linear-gradient(180deg,rgba(255,255,255,0.96)_0%,rgba(250,247,240,0.98)_100%)] p-6 shadow-[0_18px_60px_-36px_rgba(13,59,46,0.18)] backdrop-blur-xl">
          <OpenBookLoader title="Loading career applications" subtitle="Fetching submitted applications..." />
        </section>
      ) : null}
      {!state.loading ? (
        <>
          <AdminDataTable
            columns={columns}
            rows={state.items}
            emptyMessage="No career applications found."
            actions={(row) => (
              <div className="flex min-w-max items-center gap-2 whitespace-nowrap">
                <a
                  href={`/api/admin/career-applications/${encodeURIComponent(row.id)}/resume`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 rounded-xl border border-[#2D8A6A]/20 bg-[#EAF6EF] px-3 py-2 text-xs font-semibold text-[#0D5C48] transition hover:bg-[#DFF2E7]"
                >
                  <ExternalLink className="h-4 w-4" />
                  View PDF
                </a>
                <a
                  href={`/api/admin/career-applications/${encodeURIComponent(row.id)}/resume?download=1`}
                  className="inline-flex items-center gap-2 rounded-xl border border-[#2D8A6A]/20 bg-[#FAF7F0] px-3 py-2 text-xs font-semibold text-[#063F32] transition hover:bg-[#F1EADC]"
                >
                  <Download className="h-4 w-4" />
                  Download PDF
                </a>
              </div>
            )}
          />

          {selectedMessage ? (
            <div className="absolute min-h-screen inset-0 z-[10000] isolate flex items-start justify-center bg-[#063F32]/45 px-4 pb-10 pt-10">
              <div className="lg:w-[80%] w-full max-w-6xl rounded-[2rem] border border-[#2D8A6A]/15 bg-[#FAF7F0] p-6 shadow-[0_24px_80px_-36px_rgba(13,59,46,0.24)] sm:p-8">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-sm font-semibold uppercase tracking-[0.24em] text-[#C9A227]">
                      Career application details
                    </p>
                    <h2 className="mt-3 font-display text-2xl font-bold tracking-tight text-[#063F32]">
                      {selectedMessage.full_name || "Selected application"}
                    </h2>
                    <p className="mt-2 text-sm text-[#245C4F]">
                      Full application message and application details shown in one place.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedMessage(null)}
                    className="rounded-xl border border-[#2D8A6A]/20 bg-[#FAF7F0] px-3 py-2 text-sm font-semibold text-[#063F32] transition hover:bg-[#F1EADC]"
                  >
                    Close
                  </button>
                </div>

                <div className="mt-8 rounded-[1.5rem] border border-[#2D8A6A]/15 bg-white p-5">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#0D5C48]">
                    Message
                  </p>
                  <p className="mt-4 whitespace-pre-wrap break-words text-sm leading-7 text-[#245C4F]">
                    {selectedMessage.message || "-"}
                  </p>
                </div>
              </div>
            </div>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
