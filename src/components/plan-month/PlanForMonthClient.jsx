/* eslint-disable @next/next/no-img-element */
"use client";

import { useEffect, useMemo, useState } from "react";
import ClientPortal from "@/components/shared/ClientPortal";

function formatDate(d) {
  try {
    return new Date(d).toLocaleDateString();
  } catch {
    return "";
  }
}

export default function PlanForMonthClient({ canCreate = true }) {
  const [form, setForm] = useState({ name: "", startDate: "", endDate: "", images: [] });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [editingPlan, setEditingPlan] = useState(null);
  const [editForm, setEditForm] = useState({ name: "", startDate: "", endDate: "", images: [] });
  const [plans, setPlans] = useState([]);
  const [search, setSearch] = useState("");
  const [filterMonth, setFilterMonth] = useState("");
  const [previewImage, setPreviewImage] = useState("");

  useEffect(() => {
    if (typeof document === "undefined") return;
    const prev = document.body.style.overflow;
    if (editingPlan || previewImage) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = prev;
    }
    return () => {
      try { document.body.style.overflow = prev; } catch {}
    };
  }, [editingPlan, previewImage]);

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const res = await fetch("/api/monthly-plans", { cache: "no-store" });
        if (!res.ok) throw new Error("Unable to load plans");
        const data = await res.json();
        if (!active) return;
        setPlans(Array.isArray(data?.items) ? data.items : []);
      } catch (err) {
        console.error(err);
      }
    }
    void load();
    return () => { active = false; };
  }, []);

  const months = useMemo(() => {
    const m = new Map();
    plans.forEach((p) => {
      const d = p.start_date || p.startDate || "";
      if (!d) return;
      const dt = new Date(d);
      if (isNaN(dt.getTime())) return;
      const key = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}`;
      m.set(key, dt.toLocaleString(undefined, { month: "long", year: "numeric" }));
    });
    return Array.from(m.entries()).map(([value, label]) => ({ value, label }));
  }, [plans]);

  const visiblePlans = useMemo(() => {
    const q = search.trim().toLowerCase();
    return plans.filter((p) => {
      if (filterMonth) {
        const sd = p.start_date || p.startDate || "";
        const dt = sd ? new Date(sd) : null;
        const key = dt && !isNaN(dt.getTime()) ? `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}` : null;
        if (key !== filterMonth) return false;
      }
      if (!q) return true;
      return (p.name || "").toLowerCase().includes(q) || (p.description || "").toLowerCase().includes(q);
    });
  }, [plans, search, filterMonth]);

  const handleImageChange = (e) => {
    const files = Array.from(e.target.files || []);
    const readers = files.map((file) => new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result);
      reader.readAsDataURL(file);
    }));
    Promise.all(readers).then((urls) => setForm((p) => ({ ...p, images: [...p.images, ...urls] })));
  };

  function openEdit(plan) {
    setEditingPlan(plan);
    setEditForm({
      name: plan.name || "",
      startDate: formatForInput(plan.start_date || plan.startDate || ""),
      endDate: formatForInput(plan.end_date || plan.endDate || ""),
      images: Array.isArray(plan.image_urls) ? plan.image_urls : [],
    });
  }

  function formatForInput(d) {
    if (!d) return "";
    try {
      const dt = new Date(d);
      if (isNaN(dt.getTime())) return "";
      return dt.toISOString().slice(0, 10);
    } catch {
      return "";
    }
  }

  function closeEdit() {
    setEditingPlan(null);
    setEditForm({ name: "", startDate: "", endDate: "", images: [] });
  }

  const handleEditImageChange = (e) => {
    const files = Array.from(e.target.files || []);
    const readers = files.map((file) => new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result);
      reader.readAsDataURL(file);
    }));
    Promise.all(readers).then((urls) => setEditForm((p) => ({ ...p, images: [...p.images, ...urls] })));
  };

  const handleEditRemoveImage = (idx) => setEditForm((p) => ({ ...p, images: p.images.filter((_, i) => i !== idx) }));

  async function handleUpdateSubmit(e) {
    e.preventDefault();
    setMessage("");
    if (!editForm.name || !editForm.startDate || !editForm.endDate) {
      setMessage("Please fill all fields");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/monthly-plans/${editingPlan.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: editForm.name, startDate: editForm.startDate, endDate: editForm.endDate, imageUrls: editForm.images }),
      });

      if (res.ok) {
          // optimistic update
          const id = editingPlan.id;
          setPlans((current) => current.map((p) => (p.id === id ? { ...p, name: editForm.name, start_date: editForm.startDate, end_date: editForm.endDate, image_urls: editForm.images } : p)));
          closeEdit();
          setSuccessMessage("Plan updated successfully!");
          // refresh from server to ensure canonical state
          const d = await fetch("/api/monthly-plans", { cache: "no-store" });
          const newData = await d.json();
          setPlans(Array.isArray(newData?.items) ? newData.items : []);
      } else if (res.status === 403) {
        setMessage("Forbidden: you do not have permission to update plans.");
      } else {
        const data = await res.json().catch(() => ({}));
        setMessage(data?.error || "Failed to update plan");
      }
    } catch (err) {
      setMessage("Error: " + (err?.message || String(err)));
    } finally {
      setSaving(false);
    }
  }

  const handleRemoveImage = (idx) => setForm((p) => ({ ...p, images: p.images.filter((_, i) => i !== idx) }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage("");
    setSuccessMessage("");
    if (!form.name || !form.startDate || !form.endDate) {
      setMessage("Please fill all fields");
      return;
    }

    // Check if a plan already exists for this month
    const startMonth = new Date(form.startDate);
    const startKey = `${startMonth.getFullYear()}-${String(startMonth.getMonth() + 1).padStart(2, "0")}`;

    const existingPlan = plans.find((p) => {
      const pStart = new Date(p.start_date || p.startDate || "");
      if (isNaN(pStart.getTime())) return false;
      const pKey = `${pStart.getFullYear()}-${String(pStart.getMonth() + 1).padStart(2, "0")}`;
      return pKey === startKey;
    });

    if (existingPlan) {
      setMessage(`A plan for this month (${startMonth.toLocaleString(undefined, { month: "long", year: "numeric" })}) already exists.`);
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/monthly-plans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: form.name, startDate: form.startDate, endDate: form.endDate, imageUrls: form.images }),
      });
      if (res.ok) {
        setSuccessMessage("Plan saved successfully!");
        setForm({ name: "", startDate: "", endDate: "", images: [] });
        const d = await fetch("/api/monthly-plans", { cache: "no-store" });
        const newData = await d.json();
        setPlans(Array.isArray(newData?.items) ? newData.items : []);
      } else if (res.status === 403) {
        setMessage("Forbidden: you do not have permission to create plans.");
      } else {
        const data = await res.json().catch(() => ({}));
        setMessage(data?.error || "Failed to save plan");
      }
    } catch (error) {
      setMessage("Error: " + (error?.message || String(error)));
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    if (!successMessage) return undefined;
    const timer = window.setTimeout(() => setSuccessMessage(""), 5000);
    return () => window.clearTimeout(timer);
  }, [successMessage]);

  

  return (
    <div className="space-y-6">
      {successMessage && (
        <div className="fixed right-6 top-6 z-50 rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-3 shadow-xl shadow-emerald-200/40 text-sm font-semibold text-emerald-800">
          {successMessage}
        </div>
      )}
      {editingPlan && (
        <ClientPortal>
          <div onClick={closeEdit} className="fixed inset-0 z-[9999] flex items-start justify-center overflow-y-auto bg-[#063F32]/80 px-4 py-6 backdrop-blur-sm">
            <div onClick={(e) => e.stopPropagation()} className="mx-auto mt-6 w-full max-w-2xl rounded-[2rem] border border-[#2D8A6A]/15 bg-white p-6 shadow-[0_24px_80px_-36px_rgba(13,59,46,0.22)] sm:p-8 max-h-[calc(100vh-128px)] overflow-auto">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.24em] text-[#0D5C48]">Monthly plan</p>
                <h2 className="mt-2 text-2xl font-semibold tracking-tight text-[#063F32]">Edit monthly plan</h2>
              </div>
              <button type="button" onClick={closeEdit} className="rounded-xl border border-[#2D8A6A]/20 bg-[#FAF7F0] px-3 py-2 text-sm font-semibold text-[#063F32] transition hover:bg-[#F1EADC]">Close</button>
            </div>
            <form onSubmit={handleUpdateSubmit} className="mt-6 space-y-4">
              <div>
                <label className="block text-sm font-semibold text-[#245C4F]">Plan Name</label>
                <input value={editForm.name} onChange={(e) => setEditForm((p) => ({ ...p, name: e.target.value }))} className="mt-2 w-full rounded-2xl border border-[#2D8A6A]/20 bg-[#FAF7F0] px-4 py-3 text-sm text-[#063F32] outline-none" />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-sm font-semibold text-[#245C4F]">Start Date</label>
                  <input type="date" value={editForm.startDate} onChange={(e) => setEditForm((p) => ({ ...p, startDate: e.target.value }))} className="mt-2 w-full rounded-2xl border border-[#2D8A6A]/20 bg-[#FAF7F0] px-4 py-3 text-sm text-[#063F32] outline-none" />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-[#245C4F]">End Date</label>
                  <input type="date" value={editForm.endDate} onChange={(e) => setEditForm((p) => ({ ...p, endDate: e.target.value }))} className="mt-2 w-full rounded-2xl border border-[#2D8A6A]/20 bg-[#FAF7F0] px-4 py-3 text-sm text-[#063F32] outline-none" />
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-[#245C4F]">Images</label>
                <label className="mt-2 flex cursor-pointer items-center justify-between rounded-2xl border border-[#2D8A6A]/20 bg-[#FAF7F0] px-4 py-3 text-sm font-medium text-[#063F32]">
                  <span>{editForm.images.length > 0 ? `${editForm.images.length} image(s)` : "Choose images"}</span>
                  <span className="rounded-full bg-[#EAF6EF] px-3 py-1 text-xs font-semibold text-[#0D5C48]">Browse</span>
                  <input type="file" multiple accept="image/*" className="hidden" onChange={handleEditImageChange} />
                </label>
                {editForm.images.length > 0 && (
                  <div className="mt-3 grid grid-cols-3 gap-3">
                    {editForm.images.map((img, idx) => (
                      <div key={idx} className="relative overflow-hidden rounded-2xl border border-[#2D8A6A]/10 bg-white shadow-sm">
                        <img src={img} alt={`edit-preview-${idx}`} className="h-20 w-full object-cover" />
                        <button type="button" onClick={() => handleEditRemoveImage(idx)} className="absolute right-2 top-2 rounded-full bg-red-500 px-2 py-1 text-xs text-white">×</button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-3">
                <button type="button" onClick={closeEdit} className="rounded-2xl border px-4 py-2 text-sm">Cancel</button>
                <button type="submit" disabled={saving} className="inline-flex rounded-2xl bg-[#0D5C48] px-4 py-2 text-sm font-semibold text-[#FAF7F0]">{saving ? "Saving..." : "Save changes"}</button>
              </div>
            </form>
          </div>
        </div>
      </ClientPortal>
      )}
      {canCreate ? (
        <section className="rounded-2xl border border-[#2D8A6A]/15 bg-[linear-gradient(180deg,rgba(255,255,255,0.96)_0%,rgba(250,247,240,0.98)_100%)] p-6 shadow-[0_20px_70px_-36px_rgba(13,59,46,0.18)] backdrop-blur-xl">
          <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid gap-4 lg:grid-cols-2">
            <div>
              <label className="block text-sm font-semibold text-[#245C4F]">Plan Name</label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                placeholder="Enter plan name"
                className="mt-2 w-full rounded-2xl border border-[#2D8A6A]/20 bg-[#FAF7F0] px-4 py-3 text-sm text-[#063F32] outline-none focus:border-[#2D8A6A] focus:ring-4 focus:ring-[#C9A227]/20"
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-sm font-semibold text-[#245C4F]">Start Date</label>
                <input type="date" value={form.startDate} onChange={(e) => setForm((p) => ({ ...p, startDate: e.target.value }))} className="mt-2 w-full rounded-2xl border border-[#2D8A6A]/20 bg-[#FAF7F0] px-4 py-3 text-sm text-[#063F32] outline-none focus:border-[#2D8A6A] focus:ring-4 focus:ring-[#C9A227]/20" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-[#245C4F]">End Date</label>
                <input type="date" value={form.endDate} onChange={(e) => setForm((p) => ({ ...p, endDate: e.target.value }))} className="mt-2 w-full rounded-2xl border border-[#2D8A6A]/20 bg-[#FAF7F0] px-4 py-3 text-sm text-[#063F32] outline-none focus:border-[#2D8A6A] focus:ring-4 focus:ring-[#C9A227]/20" />
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-[#245C4F]">Upload Images</label>
            <label className="mt-2 flex cursor-pointer items-center justify-between rounded-2xl border border-[#2D8A6A]/20 bg-[#FAF7F0] px-4 py-3 text-sm font-medium text-[#063F32] transition hover:border-[#2D8A6A] hover:bg-white">
              <span>{form.images.length > 0 ? `${form.images.length} image(s) selected` : "Choose images"}</span>
              <span className="rounded-full bg-[#EAF6EF] px-3 py-1 text-xs font-semibold text-[#0D5C48]">Browse</span>
              <input type="file" multiple accept="image/*" className="hidden" onChange={handleImageChange} />
            </label>
          </div>

          {form.images.length > 0 && (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {form.images.map((img, idx) => (
                <div key={idx} className="relative overflow-hidden rounded-2xl border border-[#2D8A6A]/10 bg-white shadow-sm">
                  <img src={img} alt={`preview-${idx}`} className="h-24 w-full object-cover" />
                  <button type="button" onClick={() => handleRemoveImage(idx)} className="absolute right-2 top-2 rounded-full bg-red-500 px-2 py-1 text-xs text-white">×</button>
                </div>
              ))}
            </div>
          )}

          {message && <p className={`text-sm ${message.includes("success") ? "text-green-600" : "text-red-600"}`}>{message}</p>}

          <div className="flex justify-end">
            <button type="submit" disabled={saving} className="inline-flex rounded-2xl bg-[#0D5C48] px-5 py-3 text-sm font-semibold text-[#FAF7F0] transition hover:bg-[#063F32]">
              {saving ? "Saving..." : "Save Plan"}
            </button>
          </div>
        </form>
      </section>
      ) : (
        <section className="rounded-2xl border border-[#2D8A6A]/15 bg-white p-6 shadow-[0_20px_70px_-36px_rgba(13,59,46,0.18)] backdrop-blur-xl">
          <div className="space-y-3">
            <p className="text-sm font-semibold text-[#063F32]">Monthly plans (view only)</p>
            <p className="text-sm text-[#245C4F]">Admin portal view only. Contact a coordinator to create or edit monthly plans.</p>
          </div>
        </section>
      )}

      <section className="rounded-2xl border border-[#2D8A6A]/15 bg-white py-6 px-0 shadow-[0_20px_70px_-36px_rgba(13,59,46,0.18)] backdrop-blur-xl">
        <div className="mb-4 grid gap-3 sm:grid-cols-[1fr_240px] px-6">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search plans..."
            className="w-full rounded-2xl border border-[#2D8A6A]/20 bg-[#FAF7F0] px-4 py-3 text-sm text-[#063F32] outline-none focus:border-[#2D8A6A] focus:ring-4 focus:ring-[#C9A227]/20"
          />
          <select value={filterMonth} onChange={(e) => setFilterMonth(e.target.value)} className="w-full rounded-2xl border border-[#2D8A6A]/20 bg-[#FAF7F0] px-4 py-3 text-sm text-[#063F32] outline-none focus:border-[#2D8A6A] focus:ring-4 focus:ring-[#C9A227]/20">
            <option value="">All months</option>
            {months.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
          </select>
        </div>

        <h3 className="text-sm font-semibold text-[#063F32] px-6">Plans</h3>
        <div className="mt-3 overflow-x-auto">
          <table className="min-w-full divide-y divide-[#F1EADC]">
            <thead className="bg-[linear-gradient(180deg,#FAF7F0_0%,#F1EADC_100%)]">
              <tr className="text-left text-xs font-semibold uppercase tracking-[0.18em] text-[#0D5C48]">
                <th className="px-6 py-4">Name</th>
                <th className="px-6 py-4">Start</th>
                <th className="px-6 py-4">End</th>
                <th className="px-6 py-4">Images</th>
                <th className="px-6 py-4">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F1EADC] bg-[#FFFEFB]">
              {visiblePlans.map((row, index) => (
                <tr key={row.id} className={`align-top ${index % 2 === 0 ? "" : ""}`}>
                  <td className="px-6 py-5 text-sm text-[#063F32]">{row.name}</td>
                  <td className="px-6 py-5 text-sm text-[#245C4F]">{formatDate(row.start_date || row.startDate)}</td>
                  <td className="px-6 py-5 text-sm text-[#245C4F]">{formatDate(row.end_date || row.endDate)}</td>
                  <td className="px-6 py-5">
                    <div className="flex flex-wrap gap-2">
                      {(Array.isArray(row.image_urls) ? row.image_urls : []).map((img, i) => (
                          <button key={i} onClick={() => setPreviewImage(img)} className="inline-block hover:opacity-80 transition">
                            <img src={img} alt={`img-${i}`} className="h-10 w-10 rounded object-cover cursor-pointer" />
                          </button>
                        ))}
                    </div>
                  </td>
                  <td className="px-6 py-5">
                    {canCreate ? (
                      <button type="button" onClick={() => openEdit(row)} className="rounded-xl border px-3 py-2 text-xs font-semibold transition border-[#2D8A6A]/20 bg-[#FAF7F0] text-[#063F32] hover:bg-[#F1EADC]">Edit</button>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      {previewImage && (
        <ClientPortal>
          <div onClick={() => setPreviewImage("")} className="fixed inset-0 z-[9999] flex items-start justify-center overflow-y-auto bg-[#063F32]/80 px-4 py-6 backdrop-blur-sm">
            <div onClick={(e) => e.stopPropagation()} className="mx-auto mt-6 w-full max-w-4xl rounded-[2rem] border border-[#2D8A6A]/15 bg-white p-4 shadow-[0_24px_80px_-36px_rgba(13,59,46,0.22)] sm:p-6 max-h-[90vh] overflow-auto">
            <div className="flex items-start justify-between mb-4">
              <h3 className="text-lg font-semibold text-[#063F32]">Plan Image</h3>
              <button onClick={() => setPreviewImage("")} className="rounded-full text-[#245C4F] hover:text-[#063F32] text-xl">×</button>
            </div>
            <div className="rounded-xl overflow-hidden bg-[#F1EADC]">
              <img src={previewImage} alt="preview" className="w-full h-auto max-h-[80vh] object-contain" />
            </div>
          </div>
        </div>
      </ClientPortal>
      )}
    </div>
  );
}

