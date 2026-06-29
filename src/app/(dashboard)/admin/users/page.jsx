"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import AdminConfirmDialog from "@/components/admin/AdminConfirmDialog";
import AdminDashboardCards from "@/components/admin/AdminDashboardCards";
import AdminDataTable from "@/components/admin/AdminDataTable";
import StaffFormModal from "@/components/admin/StaffFormModal";
import { useDashboardSession } from "@/components/layout/DashboardSessionContext";

const ROLE_OPTIONS = ["", "admin", "coordinator", "teacher", "parent", "student"];
const STAFF_ROLE_OPTIONS = ["", "admin", "coordinator", "teacher"];
const CACHE_TTL = 60 * 1000;
const DEFAULT_FILTERS = {
  search: "",
  role: "",
  status: "",
  classLevel: "",
};

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
  if (filters.classLevel) params.set("class_level", filters.classLevel);
  return `admin-users:${params.toString()}`;
}

function getOverviewCacheKey(view) {
  return `admin-users:overview:${view}`;
}

function getStatusOptions(view) {
  if (view === "students" || view === "parents") {
    return ["", "active", "archived"];
  }

  return ["", "active", "suspended"];
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
  const session = useDashboardSession();
  const searchParams = useSearchParams();
  const view = String(searchParams.get("view") || "staff").toLowerCase();
  const rolePreset =
    view === "students"
      ? "student"
      : view === "parents"
        ? "parent"
        : "";
  const isStaffView = view === "staff";
  const currentUserId = String(session?.user?.id || "");
  const [filters, setFilters] = useState({
    search: "",
    role: rolePreset,
    status: "",
    classLevel: "",
  });
  const [state, setState] = useState(() => {
    const cached = readCache(getCacheKey({ ...DEFAULT_FILTERS, role: rolePreset }));
    const overviewCached = readCache(getOverviewCacheKey(view));

    return {
      loading: !cached,
      overviewLoading: !overviewCached,
      error: "",
      items: cached?.items || [],
      overviewItems: overviewCached?.items || [],
      summary: overviewCached?.summary || null,
    };
  });
  const [modal, setModal] = useState({ open: false, record: null });
  const [confirmState, setConfirmState] = useState({
    open: false,
    record: null,
    action: "",
    status: "",
    pending: false,
  });

  useEffect(() => {
    setFilters((current) => ({
      ...DEFAULT_FILTERS,
      search: current.search,
      role: rolePreset,
    }));
  }, [rolePreset, view]);

  const loadOverview = useCallback(async (options = {}) => {
    const force = options.force === true;
    const cacheKey = getOverviewCacheKey(view);

    if (!force) {
      const cached = readCache(cacheKey);
      if (cached) {
        setState((current) => ({
          ...current,
          overviewLoading: false,
          overviewItems: cached.items || [],
          summary: cached.summary || null,
        }));
        return cached;
      }
    }

    setState((current) => ({ ...current, overviewLoading: true }));

    try {
      const params = new URLSearchParams();

      if (view === "students") {
        params.set("role", "student");
      } else if (view === "parents") {
        params.set("role", "parent");
      }

      if (view === "staff") {
        const rolesToLoad = ["admin", "coordinator", "teacher"];
        const responses = await Promise.all(
          rolesToLoad.map((roleValue) => fetch(`/api/admin/users?role=${roleValue}`, { cache: "no-store" }))
        );
        const payloads = await Promise.all(responses.map((response) => response.json()));
        const failed = responses.find((response) => !response.ok);

        if (failed) {
          const failPayload = payloads.find((payload, index) => !responses[index].ok);
          throw new Error(failPayload?.message || "Unable to load users.");
        }

        const items = payloads.flatMap((payload) => payload.items || []);
        const summary = {
          total: items.length,
          active: items.filter((item) => item.status === "active").length,
          suspended: items.filter((item) => item.status === "suspended").length,
          archived: items.filter((item) => item.status === "archived").length,
        };

        const payload = { items, summary };
        writeCache(cacheKey, payload);
        setState((current) => ({
          ...current,
          overviewLoading: false,
          overviewItems: items,
          summary,
        }));
        return payload;
      }

      const response = await fetch(
        `/api/admin/users${params.toString() ? `?${params.toString()}` : ""}`,
        { cache: "no-store" }
      );
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.message || "Unable to load users.");
      }

      writeCache(cacheKey, data);
      setState((current) => ({
        ...current,
        overviewLoading: false,
        overviewItems: data.items || [],
        summary: data.summary || null,
      }));
      return data;
    } catch (error) {
      setState((current) => ({
        ...current,
        overviewLoading: false,
        error: error instanceof Error ? error.message : "Unable to load users.",
      }));
      return null;
    }
  }, [view]);

  const loadTable = useCallback(async (options = {}) => {
    const force = options.force === true;
    const cacheKey = getCacheKey(filters);
    setState((current) => ({ ...current, loading: true, error: "" }));

    if (!force) {
      const cached = readCache(cacheKey);
      if (cached) {
        setState((current) => ({
          ...current,
          loading: false,
          error: "",
          items: cached.items || [],
        }));
        return;
      }
    }

    try {
      const params = new URLSearchParams();
      if (filters.search) params.set("search", filters.search);
      if (filters.role) params.set("role", filters.role);
      if (filters.status) params.set("status", filters.status);
      if (filters.classLevel) params.set("class_level", filters.classLevel);

      let items = [];
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
            if (filters.classLevel) roleParams.set("class_level", filters.classLevel);
            return fetch(`/api/admin/users?${roleParams.toString()}`, { cache: "no-store" });
          })
        );

        const payloads = await Promise.all(responses.map((response) => response.json()));
        const failed = responses.find((response) => !response.ok);
        if (failed) {
          const failPayload = payloads.find((payload, index) => !responses[index].ok);
          throw new Error(failPayload?.message || "Unable to load users.");
        }

        const tableItems = payloads.flatMap((payload) => payload.items || []);
        items = filters.role
          ? tableItems.filter((item) => item.role === filters.role)
          : tableItems;
        data = { items };
      } else {
        const response = await fetch(`/api/admin/users?${params.toString()}`, {
          cache: "no-store",
        });
        data = await response.json();

        if (!response.ok) {
          throw new Error(data?.message || "Unable to load users.");
        }

        items = data.items || [];
      }

      writeCache(cacheKey, { items });
      setState((current) => ({
        ...current,
        loading: false,
        error: "",
        items,
      }));
    } catch (error) {
      setState((current) => ({
        ...current,
        loading: false,
        error: error instanceof Error ? error.message : "Unable to load users.",
        items: [],
      }));
    }
  }, [filters, isStaffView]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadOverview();
      void loadTable();
    }, 0);

    return () => window.clearTimeout(timer);
  }, [loadOverview, loadTable]);

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

    if (view === "students") {
      return [
        {
          key: "students",
          label: "Total students",
          value: state.summary?.students ?? state.items.length ?? "...",
          tone: "bg-sky-50 text-sky-800",
        },
      ];
    }

    if (view === "parents") {
      return [
        {
          key: "parents",
          label: "Total parents",
          value: state.summary?.parents ?? state.items.length ?? "...",
          tone: "bg-emerald-50 text-emerald-800",
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
  }, [state.overviewItems, state.summary, isStaffView, state.items.length, view]);

  const classOptions = useMemo(() => {
    if (view !== "students") {
      return [];
    }

    return Array.from(
      new Set(
        (state.overviewItems || [])
          .map((item) => String(item.class_level || "").trim())
          .filter(Boolean)
      )
    ).sort((left, right) => left.localeCompare(right));
  }, [state.overviewItems, view]);

  const statusOptions = useMemo(() => getStatusOptions(view), [view]);

  async function submitSearch(event) {
    event.preventDefault();
    await loadTable();
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
    if (!record?.id) {
      return;
    }

    setConfirmState({
      open: true,
      record,
      action: "archive",
      status: "archived",
      pending: false,
    });
  }

  async function activateUser(record) {
    if (!record?.id) {
      return;
    }

    setConfirmState({
      open: true,
      record,
      action: "activate",
      status: "active",
      pending: false,
    });
  }

  async function confirmStatusChange() {
    if (!confirmState.record?.id || !confirmState.action) {
      return;
    }

    setConfirmState((current) => ({ ...current, pending: true }));

    try {
      const isArchiveAction = confirmState.action === "archive";
      const endpoint = isArchiveAction
        ? `/api/admin/users/${confirmState.record.id}`
        : `/api/admin/users/${confirmState.record.id}`;
      const response = await fetch(endpoint, {
        method: isArchiveAction ? "DELETE" : "PATCH",
        headers: isArchiveAction ? undefined : { "Content-Type": "application/json" },
        body: isArchiveAction
          ? undefined
          : JSON.stringify({
              status: "active",
            }),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.message || "Unable to update user.");
      }

      setConfirmState({ open: false, record: null, action: "", status: "", pending: false });
      await Promise.all([loadOverview({ force: true }), loadTable({ force: true })]);
    } catch (error) {
      window.alert(
        error instanceof Error ? error.message : "Unable to update user."
      );
      setConfirmState((current) => ({ ...current, pending: false }));
    }
  }

  return (
    <div className="space-y-6 min-h-screen">
      <section className="rounded-[2rem] border border-white/70 bg-[linear-gradient(135deg,rgba(255,255,255,0.92),rgba(241,248,255,0.92))] p-6 shadow-[0_24px_80px_-36px_rgba(15,23,42,0.25)] sm:p-8">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
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
          className={`grid gap-3 ${
            view === "staff"
              ? "lg:grid-cols-[minmax(0,1.2fr)_220px_220px_auto]"
              : view === "students"
                ? "lg:grid-cols-[minmax(0,1.2fr)_220px_220px_auto]"
                : "lg:grid-cols-[minmax(0,1.2fr)_220px_auto]"
          }`}
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

          {view === "students" ? (
            <label className="block">
              <span className="mb-2 block text-sm font-medium text-slate-700">
                Class
              </span>
              <select
                value={filters.classLevel}
                onChange={(event) =>
                  setFilters((current) => ({
                    ...current,
                    classLevel: event.target.value,
                  }))
                }
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-sky-400 focus:bg-white focus:ring-4 focus:ring-sky-100"
              >
                <option value="">All classes</option>
                {classOptions.map((classLevel) => (
                  <option key={classLevel} value={classLevel}>
                    {classLevel}
                  </option>
                ))}
              </select>
            </label>
          ) : null}

          {view === "staff" ? (
            <label className="block">
              <span className="mb-2 block text-sm font-medium text-slate-700">
                Role
              </span>
              <select
                value={filters.role}
                onChange={(event) =>
                  setFilters((current) => ({
                    ...current,
                    role: event.target.value,
                  }))
                }
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
                onChange={(event) =>
                  setFilters((current) => ({
                    ...current,
                    status: event.target.value,
                  }))
                }
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-sky-400 focus:bg-white focus:ring-4 focus:ring-sky-100"
              >
              {statusOptions.map((option) => (
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
          ...(view === "students"
            ? [
                {
                  key: "class_level",
                  label: "Class",
                  render: (row) => row.class_level || "-",
                },
              ]
            : []),
          ...(view === "parents"
            ? [
                {
                  key: "relation",
                  label: "Relation",
                  render: (row) => row.relation || "-",
                },
                {
                  key: "student_names",
                  label: "Students",
                  render: (row) => row.student_names || "-",
                },
              ]
            : []),
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
            {view === "staff" && ["admin", "coordinator", "teacher"].includes(String(row.role || "").toLowerCase()) && String(row.id || "") !== currentUserId ? (
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
                {String(row.status || "").toLowerCase() === "archived" ? (
                  <button
                    type="button"
                    onClick={() => activateUser(row)}
                    className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-100"
                  >
                    Activate
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => deleteUser(row)}
                    className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700 transition hover:bg-rose-100"
                  >
                    Delete
                  </button>
                )}
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
          onSuccess={() => Promise.all([loadOverview({ force: true }), loadTable({ force: true })])}
        />
      ) : null}

      <AdminConfirmDialog
        open={confirmState.open}
        pending={confirmState.pending}
        title={`${
          confirmState.action === "archive" ? "Archive" : "Activate"
        } ${confirmState.record?.name || "user"}?`}
        description={
          confirmState.action === "archive"
            ? "This will move the record to archived status."
            : "This will restore the record back to active status."
        }
        confirmLabel={confirmState.action === "archive" ? "Archive" : "Activate"}
        onClose={() =>
          setConfirmState({ open: false, record: null, action: "", status: "", pending: false })
        }
        onConfirm={confirmStatusChange}
      />
    </div>
  );
}
