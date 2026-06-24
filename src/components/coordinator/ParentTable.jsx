"use client";

import { useEffect, useState } from "react";

const EMPTY_FORM = {
  id: "",
  full_name: "",
  email: "",
  phone: "",
  status: "active",
};

export default function ParentTable({ items = [], onRefresh }) {
  const [editingItem, setEditingItem] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!editingItem) return;
    setForm({
      id: editingItem.id || "",
      full_name: editingItem.full_name || "",
      email: editingItem.email || editingItem.parent_email || "",
      phone: editingItem.phone || editingItem.parent_phone || "",
      status: editingItem.status || "active",
    });
  }, [editingItem]);

  async function submitEdit(event) {
    event.preventDefault();
    setSaving(true);

    try {
      const response = await fetch("/api/coordinator/parents", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.message || "Unable to update parent.");
      setEditingItem(null);
      setForm(EMPTY_FORM);
      onRefresh?.();
    } catch (error) {
      window.alert(error.message || "Unable to update parent.");
    } finally {
      setSaving(false);
    }
  }

  function openEdit(item) {
    setEditingItem(item);
  }

  function closeEdit() {
    if (saving) return;
    setEditingItem(null);
    setForm(EMPTY_FORM);
  }

  async function archiveParent(item) {
    if (!window.confirm(`Archive ${item.full_name}?`)) return;
    const response = await fetch(`/api/coordinator/parents?id=${item.id}`, { method: "DELETE" });
    const data = await response.json();
    if (!response.ok) throw new Error(data?.message || "Unable to archive parent.");
    onRefresh?.();
  }

  return (
    <div className="overflow-hidden rounded-[1.75rem] border border-white/70 bg-white/90 shadow-[0_20px_70px_-36px_rgba(15,23,42,0.25)]">
      <div className="hidden grid-cols-[1.4fr_1fr_1.2fr_0.8fr_150px] gap-4 border-b border-slate-200 px-5 py-4 text-xs font-semibold uppercase tracking-[0.2em] text-slate-500 lg:grid">
        <span>Parent</span>
        <span>Relation</span>
        <span>Students</span>
        <span>Status</span>
        <span className="text-right">Actions</span>
      </div>
      <div className="divide-y divide-slate-200">
        {items.length ? (
          items.map((item) => (
            <div key={item.id} className="grid gap-3 px-5 py-4 lg:grid-cols-[1.4fr_1fr_1.2fr_0.8fr_150px] lg:items-center lg:gap-4">
              <div>
                <p className="font-semibold text-slate-950">{item.full_name}</p>
                <p className="mt-1 text-sm text-slate-500">
                  {item.email || item.phone || "No contact"}
                </p>
              </div>
              <p className="text-sm text-slate-600">{item.relation || "-"}</p>
              <p className="text-sm text-slate-600">{item.student_names || "-"}</p>
              <p className="text-sm font-medium text-slate-700">{item.status || "-"}</p>
              <div className="flex gap-2 lg:justify-end">
                <button
                  type="button"
                  onClick={() => openEdit(item)}
                  className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
                >
                  Edit
                </button>
                <button type="button" onClick={() => archiveParent(item).catch((error) => window.alert(error.message))} className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700">
                  Delete
                </button>
              </div>
            </div>
          ))
        ) : (
          <div className="px-5 py-10 text-sm text-slate-500">No parent records available.</div>
        )}
      </div>

      {editingItem ? (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-950/50 px-4 py-10 backdrop-blur-sm">
          <div className="w-full max-w-3xl rounded-[2rem] border border-white/70 bg-white shadow-[0_30px_90px_-40px_rgba(15,23,42,0.4)]">
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-5">
              <div>
                <h2 className="text-xl font-semibold text-slate-950">Edit Parent</h2>
                <p className="mt-1 text-sm text-slate-500">Update parent information in the coordinator portal.</p>
              </div>
              <button
                type="button"
                onClick={closeEdit}
                className="rounded-full border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-50"
              >
                Close
              </button>
            </div>

            <form onSubmit={submitEdit} className="max-h-[calc(100vh-10rem)] overflow-y-auto px-6 py-6">
              <div className="grid gap-4 md:grid-cols-2">
                <label className="space-y-2">
                  <span className="text-sm font-medium text-slate-700">Parent Name</span>
                  <input
                    value={form.full_name}
                    onChange={(event) => setForm((current) => ({ ...current, full_name: event.target.value }))}
                    className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-sky-400 focus:ring-4 focus:ring-sky-100"
                  />
                </label>
                <label className="space-y-2">
                  <span className="text-sm font-medium text-slate-700">Email</span>
                  <input
                    value={form.email}
                    onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
                    className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-sky-400 focus:ring-4 focus:ring-sky-100"
                  />
                </label>
                <label className="space-y-2">
                  <span className="text-sm font-medium text-slate-700">Phone</span>
                  <input
                    value={form.phone}
                    onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))}
                    className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-sky-400 focus:ring-4 focus:ring-sky-100"
                  />
                </label>
                <label className="space-y-2">
                  <span className="text-sm font-medium text-slate-700">Status</span>
                  <select
                    value={form.status}
                    onChange={(event) => setForm((current) => ({ ...current, status: event.target.value }))}
                    className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-sky-400 focus:ring-4 focus:ring-sky-100"
                  >
                    <option value="active">active</option>
                    <option value="suspended">suspended</option>
                    <option value="archived">archived</option>
                  </select>
                </label>
              </div>

              <div className="mt-6 flex flex-wrap justify-end gap-3 border-t border-slate-200 pt-5">
                <button
                  type="button"
                  onClick={closeEdit}
                  className="rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-2xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {saving ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
