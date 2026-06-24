"use client";

function getRoleLabel(role) {
  const value = String(role || "").toLowerCase();
  return value ? value[0].toUpperCase() + value.slice(1) : "User";
}

function getInitials(value) {
  return String(value || "U")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

export default function Topbar({ session, onMenuClick, onToggleCollapsed, collapsed }) {
  const userName =
  session?.user?.full_name ||
  session?.user?.name ||
  session?.user?.username ||
  session?.user?.email ||
  "User";
  const role = getRoleLabel(session?.user?.role);

  return (
    <header
      className={`fixed right-0 top-0 z-20 border-b border-slate-200 bg-white/90 backdrop-blur-xl ${
        collapsed ? "lg:left-20" : "lg:left-72"
      } left-0`}
    >
      <div className="flex h-20 items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onMenuClick}
            className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-700 shadow-sm transition hover:bg-slate-50 lg:hidden"
            aria-label="Open navigation menu"
          >
            <span className="flex h-4 w-4 flex-col justify-between">
              <span className="h-0.5 w-full rounded-full bg-current" />
              <span className="h-0.5 w-full rounded-full bg-current" />
              <span className="h-0.5 w-full rounded-full bg-current" />
            </span>
          </button>

          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-sky-700">
              Dashboard
            </p>
            <h1 className="text-lg font-semibold text-slate-950 sm:text-xl">
              Welcome back, {userName}
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="hidden items-center gap-3 rounded-full border border-slate-200 bg-slate-50 px-4 py-2 lg:flex">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-950 text-xs font-semibold text-white">
              {getInitials(userName)}
            </div>
            <div className="leading-tight">
              <p className="text-sm font-semibold text-slate-950">{session?.user?.email}</p>
              <p className="text-xs text-slate-500">{role}</p>
            </div>
          </div>

          <button
            type="button"
            onClick={onToggleCollapsed}
            className="hidden rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 lg:inline-flex"
          >
            {collapsed ? "Expand" : "Collapse"}
          </button>
        </div>
      </div>
    </header>
  );
}
