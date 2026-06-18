"use client";

import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { useState } from "react";

const ROLE_STYLES = {
  admin: "bg-slate-100 text-slate-700",
  coordinator: "bg-sky-50 text-sky-700",
  teacher: "bg-amber-50 text-amber-700",
  parent: "bg-violet-50 text-violet-700",
  student: "bg-emerald-50 text-emerald-700",
};

const STATUS_STYLES = {
  active: "bg-emerald-50 text-emerald-700",
  suspended: "bg-rose-50 text-rose-700",
  inactive: "bg-slate-100 text-slate-700",
};

function formatLabel(value) {
  const text = String(value || "");
  return text ? text[0].toUpperCase() + text.slice(1) : "Unknown";
}

export default function UserTable({ users }) {
  const router = useRouter();
  const [pendingId, setPendingId] = useState("");

  async function updateStatus(userId, status) {
    setPendingId(`${userId}:${status}`);

    try {
      const response = await fetch(`/api/admin/users/${userId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.message || "Status update failed.");
      }

      router.refresh();
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "Status update failed.");
    } finally {
      setPendingId("");
    }
  }

  async function resetPassword(userId) {
    const customPassword = window.prompt(
      "Enter a new password. Leave blank to generate a temporary one."
    );

    if (customPassword === null) {
      return;
    }

    setPendingId(`${userId}:password`);

    try {
      const response = await fetch(`/api/admin/users/${userId}/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          newPassword: customPassword,
        }),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.message || "Password reset failed.");
      }

      window.alert(`Password reset successful. Temporary password: ${data.temporaryPassword}`);
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "Password reset failed.");
    } finally {
      setPendingId("");
    }
  }

  if (!users.length) {
    return (
      <section className="rounded-[1.75rem] border border-dashed border-slate-300 bg-white/85 p-10 text-center text-sm text-slate-500 shadow-[0_18px_60px_-36px_rgba(15,23,42,0.18)]">
        No users match the current filters.
      </section>
    );
  }

  return (
    <section className="space-y-4">
      <div className="hidden overflow-hidden rounded-[1.75rem] border border-white/70 bg-white/90 shadow-[0_20px_70px_-36px_rgba(15,23,42,0.25)] lg:block">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50/80">
              <tr className="text-left text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                <th className="px-6 py-4">User</th>
                <th className="px-6 py-4">Role</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {users.map((user, index) => (
                <motion.tr
                  key={user.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.18, delay: index * 0.02 }}
                >
                  <td className="px-6 py-5">
                    <p className="font-semibold text-slate-950">{user.name}</p>
                    <p className="mt-1 text-sm text-slate-600">{user.email || "No email"}</p>
                    <p className="mt-1 text-sm text-slate-500">{user.phone || "No phone"}</p>
                  </td>
                  <td className="px-6 py-5">
                    <span
                      className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${
                        ROLE_STYLES[user.role] || "bg-slate-100 text-slate-700"
                      }`}
                    >
                      {formatLabel(user.role)}
                    </span>
                  </td>
                  <td className="px-6 py-5">
                    <span
                      className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${
                        STATUS_STYLES[user.status] || "bg-slate-100 text-slate-700"
                      }`}
                    >
                      {formatLabel(user.status)}
                    </span>
                  </td>
                  <td className="px-6 py-5">
                    <div className="flex flex-wrap gap-2">
                      {user.status === "active" ? (
                        <button
                          type="button"
                          disabled={pendingId === `${user.id}:suspended`}
                          onClick={() => updateStatus(user.id, "suspended")}
                          className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700 transition hover:bg-rose-100 disabled:opacity-60"
                        >
                          Suspend
                        </button>
                      ) : (
                        <button
                          type="button"
                          disabled={pendingId === `${user.id}:active`}
                          onClick={() => updateStatus(user.id, "active")}
                          className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-100 disabled:opacity-60"
                        >
                          Activate
                        </button>
                      )}

                      <button
                        type="button"
                        disabled={pendingId === `${user.id}:password`}
                        onClick={() => resetPassword(user.id)}
                        className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-100 disabled:opacity-60"
                      >
                        Reset password
                      </button>
                    </div>
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid gap-4 lg:hidden">
        {users.map((user, index) => (
          <motion.article
            key={user.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.18, delay: index * 0.02 }}
            className="rounded-[1.5rem] border border-white/70 bg-white/90 p-5 shadow-[0_18px_60px_-36px_rgba(15,23,42,0.22)]"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-lg font-semibold text-slate-950">{user.name}</p>
                <p className="mt-1 text-sm text-slate-600">{user.email || "No email"}</p>
                <p className="mt-1 text-sm text-slate-500">{user.phone || "No phone"}</p>
              </div>
              <div className="flex gap-2">
                <span
                  className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${
                    ROLE_STYLES[user.role] || "bg-slate-100 text-slate-700"
                  }`}
                >
                  {formatLabel(user.role)}
                </span>
                <span
                  className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${
                    STATUS_STYLES[user.status] || "bg-slate-100 text-slate-700"
                  }`}
                >
                  {formatLabel(user.status)}
                </span>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              {user.status === "active" ? (
                <button
                  type="button"
                  disabled={pendingId === `${user.id}:suspended`}
                  onClick={() => updateStatus(user.id, "suspended")}
                  className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700 transition hover:bg-rose-100 disabled:opacity-60"
                >
                  Suspend
                </button>
              ) : (
                <button
                  type="button"
                  disabled={pendingId === `${user.id}:active`}
                  onClick={() => updateStatus(user.id, "active")}
                  className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-100 disabled:opacity-60"
                >
                  Activate
                </button>
              )}

              <button
                type="button"
                disabled={pendingId === `${user.id}:password`}
                onClick={() => resetPassword(user.id)}
                className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-100 disabled:opacity-60"
              >
                Reset password
              </button>
            </div>
          </motion.article>
        ))}
      </div>
    </section>
  );
}
