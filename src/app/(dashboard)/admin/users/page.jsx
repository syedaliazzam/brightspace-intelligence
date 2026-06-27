"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import AdminConfirmDialog from "@/components/admin/AdminConfirmDialog";
import AdminDashboardCards from "@/components/admin/AdminDashboardCards";
import AdminDataTable from "@/components/admin/AdminDataTable";
import StaffFormModal from "@/components/admin/StaffFormModal";

const ROLE_OPTIONS = ["", "admin", "coordinator", "teacher", "parent", "student"];
const STAFF_ROLE_OPTIONS = ["", "admin", "coordinator", "teacher"];
const STATUS_OPTIONS = ["", "active", "suspended"];
const CACHE_TTL = 60 * 1000;

function formatLabel(value) {
  const text = String(value || "");
  return text
    ? text.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase())
    : "-";
}

function getCacheKey(filters) {
  const params = new URLSearchParams();
  if (filters.search) params.set("search", filters.search);
  if (filters.role) params.set("role", filters.role);
  if (filters.status) params.set("status", filters.status);
  return `admin-users:${params.toString()}`;
}

function readCache(key) {
  if (typeof window === "undefined") {
    return null;
  }

  const cached = window.sessionStorage.getItem(key);
  if (!cached) {
    return null;
  }

  try {
    const parsed = JSON.parse(cached);
    if (Date.now() - parsed.timestamp > CACHE_TTL) {
      window.sessionStorage.removeItem(key);
      return null;
    }

    return parsed.payload;
  } catch {
    window.sessionStorage.removeItem(key);
    return null;
  }
}

function writeCache(key, payload) {
  if (typeof window === "undefined") {
    return;
  }

  window.sessionStorage.setItem(
    key,
    JSON.stringify({ timestamp: Date.now(), payload })
  );
}

export default function AdminUsersPage() {
  const searchParams = useSearchParams();
  const view = String(searchParams.get("view") || "staff").toLowerCase();
  const rolePreset =
    view === "students"
      ? "student"
      : view === "parents"
        ? "parent"
        : "";
  const isStaffView = view === "staff";
  const [filters, setFilters] = useState({
    search: "",
    role: rolePreset,
    status: "",
  });
  const [state, setState] = useState(() => {
    const cached = readCache(getCacheKey({ search: "", role: "", status: "" }));

    return {
      loading: !cached,
      error: "",
      items: cached?.items || [],
      overviewItems: cached?.overviewItems || [],
      summary: cached?.summary || null,
    };
  });
  const [modal, setModal] = useState({ open: false, record: null });
  const [confirmState, setConfirmState] = useState({
    open: false,
    record: null,
    status: "",
    pending: false,
  });

  useEffect(() => {
    setFilters((current) => ({
      ...current,
      role: rolePreset,
    }));
  }, [rolePreset]);

  const load = useCallback(async (options = {}) => {
    const force = options.force === true;
    const cacheKey = getCacheKey(filters);
    setState((current) => ({ ...current, loading: true, error: "" }));

    if (!force) {
      const cached = readCache(cacheKey);
      if (cached) {
        setState({
          loading: false,
          error: "",
          items: cached.items || [],
          overviewItems: cached.overviewItems || [],
          summary: cached.summary || null,
        });
        return;
      }
    }

    try {
      const params = new URLSearchParams();
      if (filters.search) params.set("search", filters.search);
      if (filters.role) params.set("role", filters.role);
      if (filters.status) params.set("status", filters.status);

      let items = [];
      let overviewItems = [];
      let data = { items: [] };

      if (isStaffView) {
        const rolesToLoad =
          filters.role === "admin"
            ? ["admin"]
            : filters.role === "coordinator" || filters.role === "teacher"
              ? [filters.role]
              : ["admin", "coordinator", "teacher"];

        const responses = await Promise.all(
          rolesToLoad.map((roleValue) => {
            const roleParams = new URLSearchParams();
            roleParams.set("role", roleValue);
            if (filters.search) roleParams.set("search", filters.search);
            if (filters.status) roleParams.set("status", filters.status);
            return fetch(`/api/admin/users?${roleParams.toString()}`, { cache: "no-store" });
          })
        );

        const payloads = await Promise.all(responses.map((response) => response.json()));
        const failed = responses.find((response) => !response.ok);
        if (failed) {
          const failPayload = payloads.find((payload, index) => !responses[index].ok);
          throw new Error(failPayload?.message || "Unable to load users.");
        }

        overviewItems = payloads.flatMap((payload) => payload.items || []);
        items = filters.role
          ? overviewItems.filter((item) => item.role === filters.role)
          : overviewItems;
        data = { items: overviewItems };
      } else {
        const response = await fetch(`/api/admin/users?${params.toString()}`, {
          cache: "no-store",
        });
        data = await response.json();

        if (!response.ok) {
          throw new Error(data?.message || "Unable to load users.");
        }

        items = data.items || [];
        overviewItems = items;
      }

      writeCache(cacheKey, { ...data, items, overviewItems });
      setState({
        loading: false,
        error: "",
        items,
        overviewItems,
        summary: data.summary || null,
      });
    } catch (error) {
      setState({
        loading: false,
        error: error instanceof Error ? error.message : "Unable to load users.",
        items: [],
        overviewItems: [],
        summary: null,
      });
    }
  }, [filters, view]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void load();
    }, 0);

    return () => window.clearTimeout(timer);
  }, [load]);

  const cards = useMemo(() => {
    if (isStaffView) {
      const items = state.overviewItems || [];
      const staffItems = items.filter((item) => ["admin", "coordinator", "teacher"].includes(String(item.role || "").toLowerCase()));
      return [
        {
          key: "admins",
          label: "Admins",
          value: staffItems.filter((item) => item.role === "admin").length,
          tone: "bg-slate-950 text-white",
        },
        {
          key: "coordinators",
          label: "Coordinators",
          value: staffItems.filter((item) => item.role === "coordinator").length,
          tone: "bg-sky-50 text-sky-800",
        },
        {
          key: "teachers",
          label: "Teachers",
          value: staffItems.filter((item) => item.role === "teacher").length,
          tone: "bg-amber-50 text-amber-800",
        },
        {
          key: "suspendedAdmins",
          label: "Suspended admins",
          value: staffItems.filter((item) => item.role === "admin" && item.status === "suspended").length,
          tone: "bg-rose-50 text-rose-800",
        },
        {
          key: "suspendedCoordinators",
          label: "Suspended coordinators",
          value: staffItems.filter((item) => item.role === "coordinator" && item.status === "suspended").length,
          tone: "bg-rose-50 text-rose-800",
        },
        {
          key: "suspendedTeachers",
          label: "Suspended teachers",
          value: staffItems.filter((item) => item.role === "teacher" && item.status === "suspended").length,
          tone: "bg-rose-50 text-rose-800",
        },
      ];
    }

    return [
      {
        key: "coordinators",
        label: "Coordinators",
        value: state.summary?.coordinators ?? "...",
        tone: "bg-sky-50 text-sky-800",
      },
      {
        key: "teachers",
        label: "Teachers",
        value: state.summary?.teachers ?? "...",
        tone: "bg-amber-50 text-amber-800",
      },
    ];
  }, [state.overviewItems, state.summary, isStaffView]);

  async function submitSearch(event) {
    event.preventDefault();
    await load();
  }

  async function resetPassword(record) {
    const customPassword = window.prompt(
      "Enter a new password. Leave blank to auto-generate one."
    );

    if (customPassword === null) {
      return;
    }

    try {
      const response = await fetch(`/api/admin/users/${record.id}/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newPassword: customPassword }),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.message || "Unable to reset password.");
      }

      window.alert(`Temporary password: ${data.temporaryPassword}`);
    } catch (error) {
      window.alert(
        error instanceof Error ? error.message : "Unable to reset password."
      );
    }
  }

  async function deleteUser(record) {
    const confirmed = window.confirm(
      `Archive ${record.name || "this user"}?`
    );

    if (!confirmed) {
      return;
    }

    try {
      const response = await fetch(`/api/admin/users/${record.id}`, {
        method: "DELETE",
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.message || "Unable to delete user.");
      }

      void load({ force: true });
    } catch (error) {
      window.alert(
        error instanceof Error ? error.message : "Unable to delete user."
      );
    }
  }

  async function confirmStatusChange() {
    if (!confirmState.record?.id || !confirmState.status) {
      return;
    }

    setConfirmState((current) => ({ ...current, pending: true }));

    try {
      const response = await fetch(`/api/admin/staff/${confirmState.record.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName: confirmState.record.name,
          email: confirmState.record.email,
          phone: confirmState.record.phone,
          role: confirmState.record.role,
          status: confirmState.status,
        }),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.message || "Unable to update user status.");
      }

      setConfirmState({ open: false, record: null, status: "", pending: false });
      void load({ force: true });
    } catch (error) {
      window.alert(
        error instanceof Error ? error.message : "Unable to update user status."
      );
      setConfirmState((current) => ({ ...current, pending: false }));
    }
  }

  return (
    <div className="space-y-6 min-h-screen">
      <section className="rounded-[2rem] border border-white/70 bg-[linear-gradient(135deg,rgba(255,255,255,0.92),rgba(241,248,255,0.92))] p-6 shadow-[0_24px_80px_-36px_rgba(15,23,42,0.25)] sm:p-8">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-sky-700">
              User management
            </p>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">
              {view === "students"
                ? "Students management"
                : view === "parents"
                  ? "Parents management"
                  : "Staff management"}
            </h1>
            <p className="mt-3 text-sm leading-7 text-slate-600 sm:text-base">
              {view === "students"
                ? "Manage student accounts and keep their profiles organized."
                : view === "parents"
                  ? "Manage parent accounts and keep their profiles organized."
                  : "Create, update, suspend, and reset staff accounts while keeping the directory visible to admin."}
            </p>
          </div>

          {view === "staff" ? (
            <button
              type="button"
              onClick={() => setModal({ open: true, record: null })}
              className="inline-flex items-center justify-center rounded-2xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
            >
              Create staff member
            </button>
          ) : null}
        </div>
      </section>

      <AdminDashboardCards items={cards} />

      <section className="rounded-[1.75rem] border border-white/70 bg-white/90 p-4 shadow-[0_20px_70px_-36px_rgba(15,23,42,0.25)] sm:p-5">
        <form
          className={`grid gap-3 ${view === "staff" ? "lg:grid-cols-[minmax(0,1.2fr)_220px_220px_auto]" : "lg:grid-cols-[minmax(0,1.2fr)_220px_auto]"}`}
          onSubmit={submitSearch}
        >
          <label className="block">
            <span className="mb-2 block text-sm font-medium text-slate-700">
              Search users
            </span>
            <input
              type="text"
              value={filters.search}
              onChange={(event) =>
                setFilters((current) => ({
                  ...current,
                  search: event.target.value,
                }))
              }
              placeholder="Name, email, or phone"
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-sky-400 focus:bg-white focus:ring-4 focus:ring-sky-100"
            />
          </label>

          {view === "staff" ? (
            <label className="block">
              <span className="mb-2 block text-sm font-medium text-slate-700">
                Role
              </span>
              <select
                value={filters.role}
                onChange={(event) => {
                  setState((current) => ({ ...current, loading: true }));
                  setFilters((current) => ({
                    ...current,
                    role: event.target.value,
                  }));
                }}
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-sky-400 focus:bg-white focus:ring-4 focus:ring-sky-100"
              >
                {(isStaffView ? STAFF_ROLE_OPTIONS : ROLE_OPTIONS).map((option) => (
                  <option key={option || "all"} value={option}>
                    {option ? formatLabel(option) : isStaffView ? "All staff roles" : "All roles"}
                  </option>
                ))}
              </select>
            </label>
          ) : null}

          <label className="block">
            <span className="mb-2 block text-sm font-medium text-slate-700">
              Status
            </span>
            <select
              value={filters.status}
              onChange={(event) => {
                setState((current) => ({ ...current, loading: true }));
                setFilters((current) => ({
                  ...current,
                  status: event.target.value,
                }));
              }}
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-sky-400 focus:bg-white focus:ring-4 focus:ring-sky-100"
            >
              {STATUS_OPTIONS.map((option) => (
                <option key={option || "all"} value={option}>
                  {option ? formatLabel(option) : "All statuses"}
                </option>
              ))}
            </select>
          </label>

          <button
            type="submit"
            className="mt-7 inline-flex h-12 items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            Apply
          </button>
        </form>
      </section>

      {state.error ? (
        <section className="rounded-[1.75rem] border border-rose-200 bg-rose-50 p-5 text-sm text-rose-700">
          {state.error}
        </section>
      ) : null}

      <AdminDataTable
        columns={[
          {
            key: "name",
            label: "User",
            render: (row) => (
              <div>
                <p className="font-semibold text-slate-950">{row.name}</p>
                <div className="mt-1 text-xs text-slate-500">
                  <p>{row.email || "No email"}</p>
                </div>
              </div>
            ),
          },
          {
            key: "phone",
            label: "Phone",
            render: (row) => row.phone || "-",
          },
          {
            key: "role",
            label: "Role",
            render: (row) => formatLabel(row.role),
          },
          {
            key: "status",
            label: "Status",
            render: (row) => formatLabel(row.status),
          },
        ]}
        rows={state.loading ? [] : state.items}
        emptyMessage={
          state.loading ? "Loading users..." : "No users matched the current filters."
        }
        actions={(row) => (
          <>
            {view === "staff" && ["admin", "coordinator", "teacher"].includes(String(row.role || "").toLowerCase()) ? (
              <button
                type="button"
                onClick={() => setModal({ open: true, record: row })}
                className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                Edit
              </button>
            ) : null}
            {view === "staff" && ["admin", "coordinator", "teacher"].includes(String(row.role || "").toLowerCase()) ? (
              <button
                type="button"
                onClick={() =>
                  setConfirmState({
                    open: true,
                    record: row,
                    status: row.status === "suspended" ? "active" : "suspended",
                    pending: false,
                  })
                }
                className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                {row.status === "suspended" ? "Activate" : "Suspend"}
              </button>
            ) : null}
            {view === "staff" && ["admin", "coordinator", "teacher"].includes(String(row.role || "").toLowerCase()) ? (
              <button
                type="button"
                onClick={() => resetPassword(row)}
                className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                Reset password
              </button>
            ) : null}
            {view !== "staff" ? (
              <>
                <button
                  type="button"
                  onClick={() => setModal({ open: true, record: row })}
                  className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
                >
                  Edit
                </button>
                <button
                  type="button"
                  onClick={() => deleteUser(row)}
                  className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700 transition hover:bg-rose-100"
                >
                  Delete
                </button>
              </>
            ) : null}
          </>
        )}
      />

      {modal.open ? (
        <StaffFormModal
          key={modal.record?.id || "create-staff"}
          open={modal.open}
          record={modal.record}
          mode={modal.record ? "edit" : "create"}
          roleOptions={
            view === "staff"
              ? [
                  { label: "Coordinator", value: "coordinator" },
                  { label: "Teacher", value: "teacher" },
                ]
              : [
                  { label: "Admin", value: "admin" },
                  { label: "Coordinator", value: "coordinator" },
                  { label: "Teacher", value: "teacher" },
                  { label: "Parent", value: "parent" },
                  { label: "Student", value: "student" },
                ]
          }
          onClose={() => setModal({ open: false, record: null })}
          onSuccess={() => load({ force: true })}
        />
      ) : null}

      <AdminConfirmDialog
        open={confirmState.open}
        pending={confirmState.pending}
        title={`${formatLabel(confirmState.status)} ${confirmState.record?.name || "user"}?`}
        description="This action updates the staff account status and writes an audit log entry."
        confirmLabel={formatLabel(confirmState.status || "confirm")}
        onClose={() =>
          setConfirmState({ open: false, record: null, status: "", pending: false })
        }
        onConfirm={confirmStatusChange}
      />
    </div>
  );
}
