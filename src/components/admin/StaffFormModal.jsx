"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useState } from "react";

const ROLE_OPTIONS = [
  { label: "Coordinator", value: "coordinator" },
  { label: "Teacher", value: "teacher" },
];

const ALL_ROLE_OPTIONS = [
  { label: "Admin", value: "admin" },
  { label: "Coordinator", value: "coordinator" },
  { label: "Teacher", value: "teacher" },
  { label: "Parent", value: "parent" },
  { label: "Student", value: "student" },
];

const STATUS_OPTIONS = [
  { label: "Active", value: "active" },
  { label: "Suspended", value: "suspended" },
];

const PARENT_RELATION_OPTIONS = [
  { label: "Mother", value: "mother" },
  { label: "Father", value: "father" },
  { label: "Guardian", value: "guardian" },
];

function getInitialState(record) {
  return {
    fullName: record?.name || "",
    email: record?.email || "",
    phone: record?.phone || "",
    relation: record?.relation || "",
    studentNames: record?.student_names || "",
    role: record?.role || "coordinator",
    status: record?.status || "active",
    password: "",
  };
}

export default function StaffFormModal({
  open,
  mode = "create",
  record,
  onClose,
  onSuccess,
  roleOptions = ROLE_OPTIONS,
}) {
  const [form, setForm] = useState(getInitialState(record));
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const isParentEdit = mode === "edit" && form.role === "parent";

  function updateField(name, value) {
    setForm((current) => ({ ...current, [name]: value }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setPending(true);
    setError("");

    try {
      const endpoint =
        mode === "edit" && record?.id
          ? form.role === "coordinator" || form.role === "teacher"
            ? `/api/admin/staff/${record.id}`
            : `/api/admin/users/${record.id}`
          : "/api/admin/staff";
      const method = mode === "edit" ? "PATCH" : "POST";
      const payload =
        mode === "edit"
          ? {
              fullName: form.fullName,
              email: form.email,
              phone: form.phone,
              relation: form.relation,
              role: form.role,
              status: form.status,
            }
          : {
              fullName: form.fullName,
              email: form.email,
              phone: form.phone,
              role: form.role,
              password: form.password,
            };

      const response = await fetch(endpoint, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.message || "Unable to save staff record.");
      }

      onSuccess?.(data?.item);
      onClose?.();
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Unable to save staff record."
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <AnimatePresence>
      {open ? (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-slate-950/45 px-4 py-8 pt-24">
          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 18 }}
            transition={{ duration: 0.2 }}
            className="max-h-[calc(100vh-7rem)] w-full max-w-2xl overflow-y-auto rounded-[2rem] border border-white/70 bg-white p-6 shadow-[0_24px_80px_-36px_rgba(15,23,42,0.32)] sm:p-8"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.24em] text-sky-700">
                  Admin staff
                </p>
                <h2 className="mt-3 text-2xl font-semibold tracking-tight text-slate-950">
                  {mode === "edit" ? "Edit staff member" : "Create staff member"}
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
                    Full name
                  </span>
                  <input
                    type="text"
                    value={form.fullName}
                    onChange={(event) => updateField("fullName", event.target.value)}
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-sky-400 focus:bg-white focus:ring-4 focus:ring-sky-100"
                    required
                  />
                </label>

                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-slate-700">
                    Email
                  </span>
                  <input
                    type="email"
                    value={form.email}
                    onChange={(event) => updateField("email", event.target.value)}
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-sky-400 focus:bg-white focus:ring-4 focus:ring-sky-100"
                  />
                </label>

                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-slate-700">
                    Phone
                  </span>
                  <input
                    type="text"
                    value={form.phone}
                    onChange={(event) => updateField("phone", event.target.value)}
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-sky-400 focus:bg-white focus:ring-4 focus:ring-sky-100"
                  />
                </label>

                {isParentEdit ? (
                  <label className="block">
                    <span className="mb-2 block text-sm font-medium text-slate-700">
                      Relation
                    </span>
                    <select
                      value={form.relation}
                      onChange={(event) => updateField("relation", event.target.value)}
                      className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-sky-400 focus:bg-white focus:ring-4 focus:ring-sky-100"
                    >
                      <option value="">Select relation</option>
                      {PARENT_RELATION_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>
                ) : null}

                {!isParentEdit ? (
                  <label className="block">
                    <span className="mb-2 block text-sm font-medium text-slate-700">
                      Role
                    </span>
                    <select
                      value={form.role}
                      onChange={(event) => updateField("role", event.target.value)}
                      className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-sky-400 focus:bg-white focus:ring-4 focus:ring-sky-100"
                    >
                      {(mode === "edit" ? ALL_ROLE_OPTIONS : roleOptions).map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>
                ) : null}

                {mode === "edit" && !isParentEdit ? (
                  <label className="block">
                    <span className="mb-2 block text-sm font-medium text-slate-700">
                      Status
                    </span>
                    <select
                      value={form.status}
                      onChange={(event) => updateField("status", event.target.value)}
                      className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-sky-400 focus:bg-white focus:ring-4 focus:ring-sky-100"
                    >
                      {STATUS_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>
                ) : mode !== "edit" ? (
                  <label className="block">
                    <span className="mb-2 block text-sm font-medium text-slate-700">
                      Temporary password
                    </span>
                    <input
                      type="password"
                      value={form.password}
                      onChange={(event) => updateField("password", event.target.value)}
                      className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-sky-400 focus:bg-white focus:ring-4 focus:ring-sky-100"
                      minLength={8}
                      required
                    />
                  </label>
                ) : null}
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
                  {pending ? "Saving..." : mode === "edit" ? "Save changes" : "Create staff"}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      ) : null}
    </AnimatePresence>
  );
}
