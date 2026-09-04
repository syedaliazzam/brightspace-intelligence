"use client";

import { useEffect, useMemo, useState } from "react";
import { ExternalLink, Download, Search, Trash2, Pencil } from "lucide-react";
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
  const [search, setSearch] = useState("");
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [editTarget, setEditTarget] = useState(null);
  const [editForm, setEditForm] = useState({
    full_name: "",
    email: "",
    whatsapp: "",
    interested_role: "",
    source: "",
    message: "",
    admin_notes: "",
  });
  const [editResumeFile, setEditResumeFile] = useState(null);
  const [editError, setEditError] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);
  const [deleting, setDeleting] = useState(false);

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

  const filteredItems = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return state.items;
    return state.items.filter((item) => {
      return [
        item.full_name,
        item.email,
        item.whatsapp,
        item.interested_role,
        item.source,
        item.message,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query));
    });
  }, [search, state.items]);

  async function handleDelete() {
    if (!deleteTarget?.id) return;
    setDeleting(true);
    try {
      const response = await fetch(`/api/admin/career-applications/${encodeURIComponent(deleteTarget.id)}`, {
        method: "DELETE",
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data?.message || "Unable to delete application.");
      }
      setState((current) => ({
        ...current,
        items: current.items.filter((item) => item.id !== deleteTarget.id),
      }));
      setSelectedMessage((current) => (current?.id === deleteTarget.id ? null : current));
      setDeleteTarget(null);
    } catch (error) {
      setState((current) => ({
        ...current,
        error: error instanceof Error ? error.message : "Unable to delete application.",
      }));
    } finally {
      setDeleting(false);
    }
  }

  function openEdit(row) {
    setEditTarget(row);
    setEditForm({
      full_name: row.full_name || "",
      email: row.email || "",
      whatsapp: row.whatsapp || "",
      interested_role: row.interested_role || "",
      source: row.source || "",
      message: row.message || "",
      admin_notes: row.admin_notes || "",
    });
    setEditResumeFile(null);
    setEditError("");
  }

  async function handleEditSubmit(event) {
    event.preventDefault();
    if (!editTarget?.id) return;

    setSavingEdit(true);
    setEditError("");

    try {
      const formData = new FormData();
      Object.entries(editForm).forEach(([key, value]) => {
        formData.append(key, value || "");
      });
      if (editResumeFile) {
        formData.append("resume", editResumeFile);
      }

      const response = await fetch(`/api/admin/career-applications/${encodeURIComponent(editTarget.id)}`, {
        method: "PATCH",
        body: formData,
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data?.message || "Unable to update career application.");
      }

      setState((current) => ({
        ...current,
        items: current.items.map((item) => (item.id === editTarget.id ? { ...item, ...(data.item || editForm) } : item)),
      }));
      setSelectedMessage((current) => (current?.id === editTarget.id ? { ...current, ...(data.item || editForm) } : current));
      setEditResumeFile(null);
      setEditTarget(null);
    } catch (error) {
      setEditError(error instanceof Error ? error.message : "Unable to update career application.");
    } finally {
      setSavingEdit(false);
    }
  }

  const columns = useMemo(
    () => [
      {
        key: "full_name",
        label: "Full Name",
        headerClassName: "min-w-[150px] whitespace-nowrap",
        render: (row) => <span className="break-words">{row.full_name || "-"}</span>,
      },
      {
        key: "email",
        label: "Email",
        headerClassName: "min-w-[220px] whitespace-nowrap",
        render: (row) => <span className="break-all">{row.email || "-"}</span>,
      },
      { key: "whatsapp", label: "WhatsApp", headerClassName: "min-w-[150px] whitespace-nowrap" },
      {
        key: "interested_role",
        label: "Interested Role",
        headerClassName: "min-w-[190px] whitespace-nowrap",
        render: (row) => <span className="break-words">{row.interested_role || "-"}</span>,
      },
      {
        key: "message",
        label: "Message",
        headerClassName: "min-w-[140px] whitespace-nowrap",
        render: (row) => (
          <div className="inline-block">
            <button
              type="button"
              onClick={() => setSelectedMessage((current) => (current?.id === row.id ? null : row))}
              className="inline-flex w-max whitespace-nowrap rounded-full border border-[#2D8A6A]/20 bg-[#EAF6EF] px-3 py-2 text-left text-sm font-semibold text-[#0D5C48] transition hover:bg-[#DFF2E7] hover:text-[#063F32]"
            >
              Message View
            </button>
          </div>
        ),
      },
      {
        key: "source",
        label: "Source",
        headerClassName: "min-w-[140px] whitespace-nowrap",
        render: (row) => <span className="break-words">{row.source || "-"}</span>,
      },
      {
        key: "submitted_at",
        label: "Submitted At",
        headerClassName: "min-w-[190px] whitespace-nowrap",
        render: (row) => formatDate(row.submitted_at),
      },
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
      {!state.loading ? (
        <section className="rounded-[1.75rem] border border-[#2D8A6A]/15 bg-[linear-gradient(180deg,rgba(255,255,255,0.96)_0%,rgba(250,247,240,0.98)_100%)] p-4 shadow-[0_18px_60px_-36px_rgba(13,59,46,0.18)]">
          <label className="flex items-center gap-3 rounded-2xl border border-[#2D8A6A]/15 bg-white px-4 py-3 shadow-sm">
            <Search className="h-4 w-4 text-[#0D5C48]" />
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search by name, email, role, source, or message"
              className="w-full bg-transparent text-sm text-[#063F32] outline-none placeholder:text-[#7A938B]"
            />
          </label>
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
            rows={filteredItems}
            emptyMessage="No career applications found."
            tableOnMobile
            actions={(row) => (
              <div className="flex min-w-max items-center gap-2 whitespace-nowrap">
                <a
                  href={`/api/admin/career-applications/${encodeURIComponent(row.id)}/resume`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-[#2D8A6A]/20 bg-[#EAF6EF] px-3 py-2 text-xs font-semibold text-[#0D5C48] transition hover:bg-[#DFF2E7]"
                >
                  <ExternalLink className="h-4 w-4" />
                  View Document
                </a>
                <a
                  href={`/api/admin/career-applications/${encodeURIComponent(row.id)}/resume?download=1`}
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-[#2D8A6A]/20 bg-[#FAF7F0] px-3 py-2 text-xs font-semibold text-[#063F32] transition hover:bg-[#F1EADC]"
                >
                  <Download className="h-4 w-4" />
                  Download Document
                </a>
                <button
                  type="button"
                  onClick={() => openEdit(row)}
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-[#2D8A6A]/20 bg-white px-3 py-2 text-xs font-semibold text-[#063F32] transition hover:bg-[#F1EADC]"
                >
                  <Pencil className="h-4 w-4" />
                  Edit
                </button>
                <button
                  type="button"
                  onClick={() => setDeleteTarget(row)}
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700 transition hover:bg-rose-100"
                >
                  <Trash2 className="h-4 w-4" />
                  Delete
                </button>
              </div>
            )}
          />

          {selectedMessage ? (
            <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-[#063F32]/45 px-4 py-6 backdrop-blur-sm">
              <div className="w-full max-w-3xl rounded-[2rem] border border-[#2D8A6A]/15 bg-[#FAF7F0] p-6 shadow-[0_24px_80px_-36px_rgba(13,59,46,0.24)] sm:p-8">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-sm font-semibold uppercase tracking-[0.24em] text-[#C9A227]">
                      Full message
                    </p>
                    <h2 className="mt-3 font-display text-2xl font-bold tracking-tight text-[#063F32]">
                      {selectedMessage.full_name || "Career application"}
                    </h2>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedMessage(null)}
                    className="rounded-xl border border-[#2D8A6A]/20 bg-white px-3 py-2 text-sm font-semibold text-[#063F32] transition hover:bg-[#F1EADC]"
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

          {editTarget ? (
            <div className="fixed inset-0 z-[10000] overflow-y-auto bg-[#063F32]/45 px-4 py-8 backdrop-blur-sm sm:py-10">
              <form onSubmit={handleEditSubmit} className="mx-auto max-h-[calc(100vh-4rem)] w-full max-w-3xl overflow-y-auto rounded-[2rem] border border-[#2D8A6A]/15 bg-[#FAF7F0] p-6 shadow-[0_24px_80px_-36px_rgba(13,59,46,0.24)] sm:max-h-[calc(100vh-5rem)] sm:p-8">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-sm font-semibold uppercase tracking-[0.24em] text-[#C9A227]">
                      Edit application
                    </p>
                    <h2 className="mt-3 font-display text-2xl font-bold tracking-tight text-[#063F32]">
                      {editTarget.full_name || "Career application"}
                    </h2>
                  </div>
                  <button
                    type="button"
                    onClick={() => setEditTarget(null)}
                    disabled={savingEdit}
                    className="rounded-xl border border-[#2D8A6A]/20 bg-white px-3 py-2 text-sm font-semibold text-[#063F32] transition hover:bg-[#F1EADC] disabled:opacity-60"
                  >
                    Close
                  </button>
                </div>

                {editError ? (
                  <div className="mt-5 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">
                    {editError}
                  </div>
                ) : null}

                <div className="mt-6 grid gap-4 md:grid-cols-2">
                  {[
                    ["full_name", "Full name"],
                    ["email", "Email"],
                    ["whatsapp", "WhatsApp"],
                    ["interested_role", "Interested role"],
                    ["source", "Source"],
                  ].map(([key, label]) => (
                    <label key={key} className="space-y-2">
                      <span className="text-sm font-semibold text-[#245C4F]">{label}</span>
                      <input
                        value={editForm[key]}
                        onChange={(event) => setEditForm((current) => ({ ...current, [key]: event.target.value }))}
                        className="w-full rounded-2xl border border-[#2D8A6A]/20 bg-white px-4 py-3 text-sm text-[#063F32] outline-none transition focus:border-[#2D8A6A] focus:ring-4 focus:ring-[#C9A227]/20"
                      />
                    </label>
                  ))}

                  <label className="space-y-2 md:col-span-2">
                    <span className="text-sm font-semibold text-[#245C4F]">Message</span>
                    <textarea
                      rows={4}
                      value={editForm.message}
                      onChange={(event) => setEditForm((current) => ({ ...current, message: event.target.value }))}
                      className="w-full rounded-2xl border border-[#2D8A6A]/20 bg-white px-4 py-3 text-sm text-[#063F32] outline-none transition focus:border-[#2D8A6A] focus:ring-4 focus:ring-[#C9A227]/20"
                    />
                  </label>

                  <label className="space-y-2 md:col-span-2">
                    <span className="text-sm font-semibold text-[#245C4F]">Admin notes</span>
                    <textarea
                      rows={3}
                      value={editForm.admin_notes}
                      onChange={(event) => setEditForm((current) => ({ ...current, admin_notes: event.target.value }))}
                      className="w-full rounded-2xl border border-[#2D8A6A]/20 bg-white px-4 py-3 text-sm text-[#063F32] outline-none transition focus:border-[#2D8A6A] focus:ring-4 focus:ring-[#C9A227]/20"
                    />
                  </label>

                  <div className="space-y-3 md:col-span-2">
                    <span className="text-sm font-semibold text-[#245C4F]">Resume / document</span>
                    <label className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#2D8A6A]/20 bg-white px-4 py-3">
                      <span className="min-w-0 text-sm text-[#245C4F]">
                        Current:{" "}
                        <span className="font-semibold text-[#063F32]">
                          {editTarget.resume_file_name || "No document uploaded"}
                        </span>
                      </span>
                      <span className="rounded-xl bg-[#0D5C48] px-4 py-2 text-sm font-semibold text-[#FAF7F0]">
                        Choose new file
                      </span>
                      <input
                        type="file"
                        accept=".pdf,.doc,.docx,.png,.jpg,.jpeg"
                        onChange={(event) => setEditResumeFile(event.target.files?.[0] || null)}
                        className="sr-only"
                      />
                    </label>
                    {editResumeFile ? (
                      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#C9A227]/30 bg-[#FFF8E7] px-4 py-3 text-sm text-[#063F32]">
                        <span className="font-semibold">Selected file: {editResumeFile.name}</span>
                        <button
                          type="button"
                          onClick={() => setEditResumeFile(null)}
                          className="rounded-xl border border-[#2D8A6A]/20 bg-white px-3 py-1.5 text-xs font-semibold text-[#063F32] transition hover:bg-[#F1EADC]"
                        >
                          Remove
                        </button>
                      </div>
                    ) : null}
                  </div>
                </div>

                <div className="mt-6 flex flex-wrap justify-end gap-3 border-t border-[#2D8A6A]/10 pt-5">
                  <button
                    type="button"
                    onClick={() => setEditTarget(null)}
                    disabled={savingEdit}
                    className="rounded-xl border border-[#2D8A6A]/20 bg-white px-4 py-2.5 text-sm font-semibold text-[#063F32] transition hover:bg-[#F1EADC] disabled:opacity-60"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={savingEdit}
                    className="rounded-xl bg-[#0D5C48] px-4 py-2.5 text-sm font-semibold text-[#FAF7F0] transition hover:bg-[#063F32] disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    {savingEdit ? "Saving..." : "Save changes"}
                  </button>
                </div>
              </form>
            </div>
          ) : null}

          {deleteTarget ? (
            <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-[#063F32]/55 px-4 py-6 backdrop-blur-sm">
              <div className="w-full max-w-lg rounded-[2rem] border border-[#2D8A6A]/15 bg-[#FAF7F0] p-6 shadow-[0_28px_90px_-40px_rgba(13,59,46,0.3)]">
                <p className="text-sm font-semibold uppercase tracking-[0.24em] text-[#C9A227]">Delete application</p>
                <h3 className="mt-3 text-2xl font-semibold tracking-tight text-[#063F32]">
                  Remove this career application?
                </h3>
                <p className="mt-3 text-sm leading-7 text-[#245C4F]">
                  This will permanently delete the application submitted by{" "}
                  <span className="font-semibold text-[#063F32]">{deleteTarget.full_name || "the applicant"}</span>.
                </p>

                <div className="mt-6 flex flex-wrap justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setDeleteTarget(null)}
                    className="rounded-xl border border-[#2D8A6A]/20 bg-white px-4 py-2.5 text-sm font-semibold text-[#063F32] transition hover:bg-[#F1EADC]"
                    disabled={deleting}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleDelete()}
                    className="rounded-xl bg-rose-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-70"
                    disabled={deleting}
                  >
                    {deleting ? "Deleting..." : "Delete now"}
                  </button>
                </div>
              </div>
            </div>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
