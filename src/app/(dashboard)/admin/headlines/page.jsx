"use client";

import { useEffect, useState } from "react";
import AdminDataTable from "@/components/admin/AdminDataTable";

function emptyForm() {
  return {
    headline: "",
    startDate: "",
    endDate: "",
  };
}

function formatDate(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString();
}

function formatStatus(value) {
  return String(value || "")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function HeadlineForm({ form, onChange, onSubmit, onCancel, submitting, submitLabel }) {
  return (
    <form className="grid gap-4" onSubmit={onSubmit}>
      <label className="block">
        <span className="mb-2 block text-sm font-medium text-slate-700">Headline text</span>
        <textarea
          value={form.headline}
          onChange={(event) => onChange((current) => ({ ...current, headline: event.target.value }))}
          rows={4}
          placeholder="Enter the announcement students, teachers, and parents should see"
          className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-sky-400 focus:bg-white focus:ring-4 focus:ring-sky-100"
          required
        />
      </label>

      <div className="grid gap-4 md:grid-cols-2">
        <label className="block">
          <span className="mb-2 block text-sm font-medium text-slate-700">Start date</span>
          <input
            type="date"
            value={form.startDate}
            onChange={(event) => onChange((current) => ({ ...current, startDate: event.target.value }))}
            className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-sky-400 focus:bg-white focus:ring-4 focus:ring-sky-100"
            required
          />
        </label>

        <label className="block">
          <span className="mb-2 block text-sm font-medium text-slate-700">End date</span>
          <input
            type="date"
            value={form.endDate}
            onChange={(event) => onChange((current) => ({ ...current, endDate: event.target.value }))}
            className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-sky-400 focus:bg-white focus:ring-4 focus:ring-sky-100"
            required
          />
        </label>
      </div>

      <div className="flex flex-wrap justify-end gap-3">
        {onCancel ? (
          <button
            type="button"
            onClick={onCancel}
            className="rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            Cancel
          </button>
        ) : null}
        <button
          type="submit"
          disabled={submitting}
          className="rounded-2xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {submitting ? "Saving..." : submitLabel}
        </button>
      </div>
    </form>
  );
}

export default function AdminHeadlinesPage() {
  const [items, setItems] = useState([]);
  const [available, setAvailable] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [createForm, setCreateForm] = useState(emptyForm);
  const [editForm, setEditForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState("");
  const [deletingItem, setDeletingItem] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  async function load() {
    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/admin/headlines", { cache: "no-store" });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.message || "Unable to load headlines.");
      }

      setItems(Array.isArray(data.items) ? data.items : []);
      setAvailable(data.available !== false);
    } catch (loadError) {
      setItems([]);
      setAvailable(false);
      setError(loadError instanceof Error ? loadError.message : "Unable to load headlines.");
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

  async function createHeadline(event) {
    event.preventDefault();
    setSubmitting(true);
    setError("");

    try {
      const response = await fetch("/api/admin/headlines", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(createForm),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.message || "Unable to save headline.");
      }

      setCreateForm(emptyForm());
      await load();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Unable to save headline.");
    } finally {
      setSubmitting(false);
    }
  }

  async function updateHeadline(event) {
    event.preventDefault();
    setSubmitting(true);
    setError("");

    try {
      const response = await fetch(`/api/admin/headlines/${editingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editForm),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.message || "Unable to save headline.");
      }

      setEditingId("");
      setEditForm(emptyForm());
      await load();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Unable to save headline.");
    } finally {
      setSubmitting(false);
    }
  }

  async function confirmDelete() {
    if (!deletingItem?.id) return;
    setError("");
    setSubmitting(true);

    try {
      const response = await fetch(`/api/admin/headlines/${deletingItem.id}`, {
        method: "DELETE",
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.message || "Unable to delete headline.");
      }

      if (editingId === deletingItem.id) {
        setEditForm(emptyForm());
        setEditingId("");
      }

      setDeletingItem(null);
      await load();
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Unable to delete headline.");
    } finally {
      setSubmitting(false);
    }
  }

  function startEdit(item) {
    setEditingId(item.id);
    setEditForm({
      headline: item.headline || "",
      startDate: String(item.start_date || "").slice(0, 10),
      endDate: String(item.end_date || "").slice(0, 10),
    });
  }

  return (
    <div className="space-y-6 min-h-screen">
      <section className="rounded-[2rem] border border-white/70 bg-[linear-gradient(135deg,rgba(255,255,255,0.92),rgba(241,248,255,0.92))] p-6 shadow-[0_24px_80px_-36px_rgba(15,23,42,0.25)] sm:p-8">
        <div className="max-w-3xl">
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">Schedule dashboard announcements</h1>
          <p className="mt-3 text-sm leading-7 text-slate-600 sm:text-base">
            Create time-based headlines that appear at the top of student, teacher, and parent dashboards while their date range is active.
          </p>
        </div>
      </section>

      <section className="rounded-[1.75rem] border border-white/70 bg-white/90 p-5 shadow-[0_20px_70px_-36px_rgba(15,23,42,0.25)] sm:p-6">
        <div className="mb-5 flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.22em] text-sky-700">Create headline</p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">New dashboard headline</h2>
          </div>
        </div>

        <HeadlineForm
          form={createForm}
          onChange={setCreateForm}
          onSubmit={createHeadline}
          submitting={submitting}
          submitLabel="Create headline"
        />
      </section>

      {error ? (
        <section className="rounded-[1.75rem] border border-rose-200 bg-rose-50 p-5 text-sm text-rose-700">
          {error}
        </section>
      ) : null}

      {!available ? (
        <section className="rounded-[1.75rem] border border-dashed border-amber-300 bg-amber-50 p-5 text-sm text-amber-800">
          Headlines table is not available yet. Run the SQL script first, then refresh this page.
        </section>
      ) : null}

      <AdminDataTable
        columns={[
          {
            key: "headline",
            label: "Headline",
            render: (row) => <p className="max-w-xl whitespace-pre-wrap font-medium text-slate-950">{row.headline}</p>,
          },
          {
            key: "date_range",
            label: "Date range",
            render: (row) => `${formatDate(row.start_date)} to ${formatDate(row.end_date)}`,
          },
          {
            key: "display_status",
            label: "Status",
            render: (row) => formatStatus(row.display_status),
          },
          {
            key: "created_by_name",
            label: "Created by",
            render: (row) => row.created_by_name || "Admin",
          },
        ]}
        rows={loading ? [] : items}
        emptyMessage={loading ? "Loading headlines..." : "No headlines have been created yet."}
        actions={(row) => (
          <>
            <button
              type="button"
              onClick={() => startEdit(row)}
              className="rounded-xl border border-sky-200 bg-sky-50 px-3 py-2 text-xs font-semibold text-sky-700 transition hover:bg-sky-100"
            >
              Edit
            </button>
            <button
              type="button"
              onClick={() => setDeletingItem(row)}
              className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700 transition hover:bg-rose-100"
            >
              Delete
            </button>
          </>
        )}
      />

      {editingId ? (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/35 px-4 pb-8 pt-24 backdrop-blur-sm sm:pt-28">
          <div className="mx-auto w-full max-w-3xl">
            <section className="overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-[0_32px_90px_-38px_rgba(15,23,42,0.4)]">
              <div className="bg-[linear-gradient(135deg,rgba(8,47,73,0.98),rgba(14,116,144,0.96),rgba(224,242,254,0.94))] px-6 py-6 text-white sm:px-8">
                <div className="flex items-start justify-between gap-4">
                  <div className="max-w-2xl">
                    <p className="text-sm font-semibold uppercase tracking-[0.24em] text-sky-100">Edit headline</p>
                    <h2 className="mt-3 text-2xl font-semibold tracking-tight sm:text-3xl">Update the scheduled announcement</h2>
                    <p className="mt-3 text-sm leading-7 text-sky-50/90">
                      Refine the message and schedule window here. This popup stays near the top so it feels connected to the admin header.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setEditingId("");
                      setEditForm(emptyForm());
                    }}
                    className="rounded-2xl border border-white/20 bg-white/10 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/20"
                  >
                    Close
                  </button>
                </div>
              </div>

              <div className="p-6 sm:p-8">
                <HeadlineForm
                  form={editForm}
                  onChange={setEditForm}
                  onSubmit={updateHeadline}
                  onCancel={() => {
                    setEditingId("");
                    setEditForm(emptyForm());
                  }}
                  submitting={submitting}
                  submitLabel="Update headline"
                />
              </div>
            </section>
          </div>
        </div>
      ) : null}

      {deletingItem ? (
        <div className="fixed inset-0 z-[60] overflow-y-auto bg-slate-950/45 px-4 pb-8 pt-20 backdrop-blur-sm sm:pt-24">
          <div className="mx-auto w-full max-w-2xl">
            <section className="overflow-hidden rounded-[2rem] border border-rose-200 bg-white shadow-[0_32px_90px_-38px_rgba(15,23,42,0.42)]">
              <div className="bg-[linear-gradient(135deg,rgba(127,29,29,0.98),rgba(185,28,28,0.95),rgba(254,226,226,0.92))] px-6 py-6 text-white sm:px-8">
                <div className="flex items-start justify-between gap-4">
                  <div className="max-w-xl">
                    <p className="text-sm font-semibold uppercase tracking-[0.24em] text-rose-100">Delete headline</p>
                    <h2 className="mt-3 text-2xl font-semibold tracking-tight sm:text-3xl">Remove this dashboard headline?</h2>
                    <p className="mt-3 text-sm leading-7 text-rose-50/90">
                      This action will permanently remove the scheduled announcement from student, teacher, and parent dashboards.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setDeletingItem(null)}
                    className="rounded-2xl border border-white/20 bg-white/10 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/20"
                  >
                    Close
                  </button>
                </div>
              </div>

              <div className="space-y-5 p-6 sm:p-8">
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Headline preview</p>
                  <p className="mt-3 whitespace-pre-wrap text-base font-medium text-slate-950">{deletingItem.headline || "-"}</p>
                  <p className="mt-3 text-sm text-slate-600">
                    {formatDate(deletingItem.start_date)} to {formatDate(deletingItem.end_date)}
                  </p>
                </div>

                <div className="flex flex-wrap justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setDeletingItem(null)}
                    className="rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={confirmDelete}
                    disabled={submitting}
                    className="rounded-2xl bg-rose-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {submitting ? "Deleting..." : "Delete headline"}
                  </button>
                </div>
              </div>
            </section>
          </div>
        </div>
      ) : null}
    </div>
  );
}
