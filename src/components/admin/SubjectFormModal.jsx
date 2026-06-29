"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useState } from "react";

function getInitialState(record) {
  return {
    name: record?.name || "",
    description: record?.description || "",
    status: record?.status || "active",
    courseIds: Array.isArray(record?.course_ids)
      ? record.course_ids
      : record?.course_id
        ? [record.course_id]
        : [],
  };
}

export default function SubjectFormModal({
  open,
  record,
  classOptions = [],
  onClose,
  onSuccess,
}) {
  const [form, setForm] = useState(getInitialState(record));
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  function updateField(name, value) {
    setForm((current) => ({ ...current, [name]: value }));
  }

  function toggleCourseId(courseId) {
    setForm((current) => {
      const exists = current.courseIds.includes(courseId);
      return {
        ...current,
        courseIds: exists
          ? current.courseIds.filter((item) => item !== courseId)
          : [...current.courseIds, courseId],
      };
    });
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setPending(true);
    setError("");

    try {
      const endpoint = record?.id
        ? `/api/admin/subjects/${record.id}`
        : "/api/admin/subjects";
      const method = record?.id ? "PATCH" : "POST";
      const response = await fetch(endpoint, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.message || "Unable to save subject.");
      }

      onSuccess?.(data?.item);
      onClose?.();
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Unable to save subject."
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <AnimatePresence>
      {open ? (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-slate-950/45 px-4 pb-8 pt-24 sm:pt-28">
          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 18 }}
            transition={{ duration: 0.2 }}
            className="w-full max-w-2xl rounded-[2rem] border border-white/70 bg-white p-6 shadow-[0_24px_80px_-36px_rgba(15,23,42,0.32)] sm:p-8"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.24em] text-sky-700">
                  Subject management
                </p>
                <h2 className="mt-3 text-2xl font-semibold tracking-tight text-slate-950">
                  {record?.id ? "Edit subject" : "Create subject"}
                </h2>
              </div>

              <button
                type="button"
                onClick={onClose}
                className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
              >
                Close
              </button>
            </div>

            <form className="mt-6 grid gap-4" onSubmit={handleSubmit}>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block sm:col-span-2">
                  <span className="mb-2 block text-sm font-medium text-slate-700">
                    Subject name
                  </span>
                  <input
                    type="text"
                    value={form.name}
                    onChange={(event) => updateField("name", event.target.value)}
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-sky-400 focus:bg-white focus:ring-4 focus:ring-sky-100"
                    required
                  />
                </label>

                <div className="block sm:col-span-2">
                  <span className="mb-2 block text-sm font-medium text-slate-700">
                    Available classes
                  </span>
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <div className="grid gap-3 sm:grid-cols-2">
                      {classOptions.map((item) => {
                        const checked = form.courseIds.includes(item.id);
                        return (
                          <label
                            key={item.id}
                            className={`flex items-center gap-3 rounded-2xl border px-4 py-3 text-sm transition ${
                              checked
                                ? "border-sky-200 bg-sky-50 text-sky-800"
                                : "border-slate-200 bg-white text-slate-700"
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => toggleCourseId(item.id)}
                              className="h-4 w-4 rounded border-slate-300 text-sky-600 focus:ring-sky-500"
                            />
                            <span>{item.class_level || item.title}</span>
                          </label>
                        );
                      })}
                    </div>
                    {!classOptions.length ? (
                      <p className="text-sm text-slate-500">No active classes available.</p>
                    ) : null}
                  </div>
                </div>

                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-slate-700">
                    Status
                  </span>
                  <select
                    value={form.status}
                    onChange={(event) => updateField("status", event.target.value)}
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-sky-400 focus:bg-white focus:ring-4 focus:ring-sky-100"
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                    <option value="archived">Archived</option>
                  </select>
                </label>

                <label className="block sm:col-span-2">
                  <span className="mb-2 block text-sm font-medium text-slate-700">
                    Description
                  </span>
                  <textarea
                    rows={5}
                    value={form.description}
                    onChange={(event) =>
                      updateField("description", event.target.value)
                    }
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-sky-400 focus:bg-white focus:ring-4 focus:ring-sky-100"
                  />
                </label>
              </div>

              {error ? (
                <p className="rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-700">
                  {error}
                </p>
              ) : null}

              <div className="flex flex-wrap justify-end gap-3">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={pending}
                  className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-60"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={pending}
                  className="rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-60"
                >
                  {pending ? "Saving..." : "Save subject"}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      ) : null}
    </AnimatePresence>
  );
}
