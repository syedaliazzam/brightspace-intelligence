"use client";

import { useEffect, useState } from "react";
import AdminDashboardCards from "@/components/admin/AdminDashboardCards";
import AdminDataTable from "@/components/admin/AdminDataTable";

const CACHE_KEY = "admin-fee-settings";
const CACHE_TTL = 60 * 1000;

function readCache() {
  if (typeof window === "undefined") {
    return null;
  }

  const cached = window.sessionStorage.getItem(CACHE_KEY);
  if (!cached) {
    return null;
  }

  try {
    const parsed = JSON.parse(cached);
    if (Date.now() - parsed.timestamp > CACHE_TTL) {
      window.sessionStorage.removeItem(CACHE_KEY);
      return null;
    }

    return parsed.payload;
  } catch {
    window.sessionStorage.removeItem(CACHE_KEY);
    return null;
  }
}

function writeCache(payload) {
  if (typeof window === "undefined") {
    return;
  }

  window.sessionStorage.setItem(
    CACHE_KEY,
    JSON.stringify({ timestamp: Date.now(), payload })
  );
}

export default function AdminFeeSettingsPage() {
  const [state, setState] = useState(() => {
    const cached = readCache();

    return {
      loading: !cached,
      error: "",
      available: cached?.available !== false,
      settings: cached?.settings || [],
      finance: cached?.finance || {
        totalSettings: 0,
        voucherCreated: 0,
        vouchersSubmitted: 0,
        paymentsVerified: 0,
      },
      recentVouchers: cached?.recentVouchers || [],
      recentSubmissions: cached?.recentSubmissions || [],
    };
  });
  const [editingId, setEditingId] = useState("");
  const [drafts, setDrafts] = useState(() => {
    const cached = readCache();

    return (cached?.settings || []).reduce((accumulator, item) => {
      accumulator[item.id] = {
        value: item.value || "",
        description: item.description || "",
        status: item.status || "active",
      };
      return accumulator;
    }, {});
  });

  async function load(options = {}) {
    const force = options.force === true;

    setState((current) => ({ ...current, loading: true, error: "" }));

    if (!force) {
      const cached = readCache();
      if (cached) {
        setState({
          loading: false,
          error: "",
          available: cached.available !== false,
          settings: cached.settings || [],
          finance: cached.finance || {
            totalSettings: 0,
            voucherCreated: 0,
            vouchersSubmitted: 0,
            paymentsVerified: 0,
          },
          recentVouchers: cached.recentVouchers || [],
          recentSubmissions: cached.recentSubmissions || [],
        });

        setDrafts(
          (cached.settings || []).reduce((accumulator, item) => {
            accumulator[item.id] = {
              value: item.value || "",
              description: item.description || "",
              status: item.status || "active",
            };
            return accumulator;
          }, {})
        );
        return;
      }
    }

    try {
      const response = await fetch("/api/admin/fee-settings", {
        cache: "no-store",
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.message || "Unable to load fee settings.");
      }

      writeCache(data);
      setState({
        loading: false,
        error: "",
        available: data.available !== false,
        settings: data.settings || [],
        finance: data.finance || {
          totalSettings: 0,
          voucherCreated: 0,
          vouchersSubmitted: 0,
          paymentsVerified: 0,
        },
        recentVouchers: data.recentVouchers || [],
        recentSubmissions: data.recentSubmissions || [],
      });

      setDrafts(
        (data.settings || []).reduce((accumulator, item) => {
          accumulator[item.id] = {
            value: item.value || "",
            description: item.description || "",
            status: item.status || "active",
          };
          return accumulator;
        }, {})
      );
    } catch (error) {
      setState((current) => ({
        ...current,
        loading: false,
        error:
          error instanceof Error
            ? error.message
            : "Unable to load fee settings.",
      }));
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function saveSetting(id) {
    const draft = drafts[id];

    try {
      const response = await fetch("/api/admin/fee-settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id,
          value: draft?.value || "",
          description: draft?.description || "",
          status: draft?.status || "active",
        }),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.message || "Unable to update fee setting.");
      }

      setEditingId("");
      void load({ force: true });
    } catch (error) {
      window.alert(
        error instanceof Error ? error.message : "Unable to update fee setting."
      );
    }
  }

  return (
    <div className="space-y-6">
      <section className="rounded-[2rem] border border-white/70 bg-[linear-gradient(135deg,rgba(255,255,255,0.92),rgba(241,248,255,0.92))] p-6 shadow-[0_24px_80px_-36px_rgba(15,23,42,0.25)] sm:p-8">
        <div className="max-w-3xl">
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-sky-700">
            Fee settings
          </p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">
            Fee configuration and finance visibility
          </h1>
          <p className="mt-3 text-sm leading-7 text-slate-600 sm:text-base">
            Adjust available fee settings and monitor voucher and submission movement without entering payment verification workflows.
          </p>
        </div>
      </section>

      <AdminDashboardCards
        items={[
          {
            key: "voucherCreated",
            label: "Vouchers created",
            value: state.finance.voucherCreated,
            tone: "bg-sky-50 text-sky-800",
          },
          {
            key: "submitted",
            label: "Vouchers submitted",
            value: state.finance.vouchersSubmitted,
            tone: "bg-amber-50 text-amber-800",
          },
          {
            key: "verified",
            label: "Payments verified",
            value: state.finance.paymentsVerified,
            tone: "bg-emerald-50 text-emerald-800",
          },
        ]}
      />

      {state.error ? (
        <section className="rounded-[1.75rem] border border-rose-200 bg-rose-50 p-5 text-sm text-rose-700">
          {state.error}
        </section>
      ) : null}

      {state.available && state.settings.length ? (
        <section className="rounded-[1.75rem] border border-white/70 bg-white/90 p-5 shadow-[0_20px_70px_-36px_rgba(15,23,42,0.25)]">
          <div className="space-y-4">
            {state.settings.map((setting) => {
              const draft = drafts[setting.id] || {};
              const isEditing = editingId === setting.id;

              return (
                <article
                  key={setting.id}
                  className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
                >
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <p className="text-lg font-semibold text-slate-950">
                        {setting.name}
                      </p>
                      <p className="mt-1 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                        {setting.setting_key}
                      </p>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {isEditing ? (
                        <>
                          <button
                            type="button"
                            onClick={() => saveSetting(setting.id)}
                            className="rounded-xl bg-slate-950 px-3 py-2 text-xs font-semibold text-white transition hover:bg-slate-800"
                          >
                            Save
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingId("")}
                            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
                          >
                            Cancel
                          </button>
                        </>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setEditingId(setting.id)}
                          className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
                        >
                          Edit
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_220px]">
                    <label className="block">
                      <span className="mb-2 block text-sm font-medium text-slate-700">
                        Value
                      </span>
                      <input
                        type="text"
                        disabled={!isEditing}
                        value={draft.value || ""}
                        onChange={(event) =>
                          setDrafts((current) => ({
                            ...current,
                            [setting.id]: {
                              ...current[setting.id],
                              value: event.target.value,
                            },
                          }))
                        }
                        className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-sky-400 focus:ring-4 focus:ring-sky-100 disabled:bg-slate-100"
                      />
                    </label>

                    <label className="block">
                      <span className="mb-2 block text-sm font-medium text-slate-700">
                        Status
                      </span>
                      <select
                        disabled={!isEditing}
                        value={draft.status || "active"}
                        onChange={(event) =>
                          setDrafts((current) => ({
                            ...current,
                            [setting.id]: {
                              ...current[setting.id],
                              status: event.target.value,
                            },
                          }))
                        }
                        className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-sky-400 focus:ring-4 focus:ring-sky-100 disabled:bg-slate-100"
                      >
                        <option value="active">Active</option>
                        <option value="inactive">Inactive</option>
                        <option value="archived">Archived</option>
                      </select>
                    </label>

                    <label className="block lg:col-span-2">
                      <span className="mb-2 block text-sm font-medium text-slate-700">
                        Description
                      </span>
                      <textarea
                        rows={4}
                        disabled={!isEditing}
                        value={draft.description || ""}
                        onChange={(event) =>
                          setDrafts((current) => ({
                            ...current,
                            [setting.id]: {
                              ...current[setting.id],
                              description: event.target.value,
                            },
                          }))
                        }
                        className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-sky-400 focus:ring-4 focus:ring-sky-100 disabled:bg-slate-100"
                      />
                    </label>
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      ) : null}

      <section className="grid gap-6 xl:grid-cols-2">
        <div className="rounded-[1.75rem] border border-white/70 bg-white/90 p-5 shadow-[0_20px_70px_-36px_rgba(15,23,42,0.25)]">
          <div className="mb-4">
            <p className="text-sm font-semibold uppercase tracking-[0.22em] text-sky-700">
              Fee vouchers
            </p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">
              Recent vouchers
            </h2>
          </div>
          <AdminDataTable
            columns={[
              { key: "voucher_no", label: "Voucher" },
              { key: "student_name", label: "Student" },
              { key: "status", label: "Status" },
            ]}
            rows={state.recentVouchers}
            emptyMessage="No recent vouchers to display."
          />
        </div>

        <div className="rounded-[1.75rem] border border-white/70 bg-white/90 p-5 shadow-[0_20px_70px_-36px_rgba(15,23,42,0.25)]">
          <div className="mb-4">
            <p className="text-sm font-semibold uppercase tracking-[0.22em] text-sky-700">
              Fee submissions
            </p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">
              Recent submissions
            </h2>
          </div>
          <AdminDataTable
            columns={[
              { key: "voucher_no", label: "Voucher" },
              { key: "student_name", label: "Student" },
              { key: "status", label: "Status" },
            ]}
            rows={state.recentSubmissions}
            emptyMessage="No recent payment submissions to display."
          />
        </div>
      </section>
    </div>
  );
}
