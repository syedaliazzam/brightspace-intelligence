"use client";

import { AnimatePresence, motion } from "framer-motion";
import { signOut } from "next-auth/react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useState } from "react";
import { getNavigationForRole } from "@/config/navigation";
import {
  LayoutDashboard,
  Users,
  UserCog,
  ReceiptText,
  CreditCard,
  GraduationCap,
  UserRound,
  CalendarDays,
  ClipboardCheck,
  FileText,
  BookOpen,
  NotebookPen,
  User,
  CalendarRange,
  Home,
  Activity,
  School,
  ShieldCheck,
  BookText,
  Layers3,
  PanelTop,
} from "lucide-react";

function isActive(pathname, href) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

function getIconForLabel(label) {
  const key = String(label || "").toLowerCase();
  if (key.includes("dashboard")) return LayoutDashboard;
  if (key.includes("interested students")) return Users;
  if (key.includes("registration")) return UserCog;
  if (key.includes("fee vouchers") || key.includes("fees")) return ReceiptText;
  if (key.includes("payments")) return CreditCard;
  if (key === "students") return GraduationCap;
  if (key === "parents") return UserRound;
  if (key.includes("teacher assignments")) return UserCog;
  if (key.includes("lecture schedule")) return CalendarDays;
  if (key.includes("lecture verification")) return ClipboardCheck;
  if (key.includes("reports")) return FileText;
  if (key.includes("lectures")) return BookOpen;
  if (key.includes("homework")) return NotebookPen;
  if (key.includes("calendar")) return CalendarRange;
  if (key.includes("attendance")) return Activity;
  if (key.includes("profile")) return User;
  if (key.includes("class management")) return School;
  if (key.includes("subject")) return BookText;
  if (key.includes("audit")) return ShieldCheck;
  if (key.includes("timeline")) return Layers3;
  if (key.includes("overview")) return PanelTop;
  return Home;
}

export default function Sidebar({
  session,
  mobileOpen,
  onMobileClose,
  collapsed,
  onToggleCollapsed,
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const role = String(session?.user?.role || "student").toLowerCase();
  const items = getNavigationForRole(role);
  const [openGroups, setOpenGroups] = useState({
    userManagement: pathname.startsWith("/admin/users"),
  });

  const adminView = String(searchParams.get("view") || "").toLowerCase();

  const shell = (
    <aside
      className={`flex h-full w-72 flex-col border-r border-slate-200 bg-white/95 shadow-[0_18px_60px_-40px_rgba(15,23,42,0.45)] backdrop-blur-xl transition-[width] duration-200 ${
        collapsed ? "lg:w-20" : "lg:w-72"
      }`}
    >
      <div
        className={`relative flex items-center gap-3 border-b border-slate-200 px-5 py-4 ${
          collapsed ? "lg:justify-center" : ""
        }`}
      >
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-slate-950 text-sm font-semibold text-white">
            {collapsed ? "L" : "LMS"}
          </div>
          <div
            className={`min-w-0 transition-all duration-200 ${
              collapsed
                ? "lg:hidden lg:max-w-0 lg:overflow-hidden lg:opacity-0 lg:pointer-events-none"
                : "lg:max-w-full opacity-100"
            }`}
          >
            <p className="truncate text-sm font-semibold text-slate-950">Learning Platform</p>
            <p className="truncate text-xs text-slate-500">{role}</p>
          </div>
        </div>

        <button
          type="button"
          onClick={onToggleCollapsed}
          className={`hidden rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-100 lg:inline-flex ${
            collapsed
              ? "lg:absolute lg:left-1/2 lg:top-1/2 lg:-translate-x-1/2 lg:-translate-y-1/2"
              : "lg:absolute lg:right-4 lg:top-1/2 lg:-translate-y-1/2"
          }`}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? ">" : "<"}
        </button>
      </div>

      <nav className="scrollbar-thin scrollbar-thumb-slate-200 flex-1 space-y-1 overflow-y-auto px-3 py-4">
        {items.map((item) => {
          if (item.label === "User Management" && Array.isArray(item.children)) {
            return (
              <div key={item.label} className="space-y-2 rounded-2xl bg-slate-50/70 p-2">
                <button
                  type="button"
                  onClick={() =>
                    setOpenGroups((current) => ({
                      ...current,
                      userManagement: !current.userManagement,
                    }))
                  }
                  className="flex w-full items-center justify-between rounded-2xl px-3 py-2 text-xs font-semibold uppercase tracking-[0.22em] text-slate-500 transition hover:bg-slate-100"
                >
                  <span className="flex items-center gap-2">
                    <span className="flex h-7 w-7 items-center justify-center rounded-xl bg-sky-600 text-white">
                      <Users className="h-3.5 w-3.5" strokeWidth={2} />
                    </span>
                    <span>{item.label}</span>
                  </span>
                  <span>{openGroups.userManagement ? "-" : "+"}</span>
                </button>

                {openGroups.userManagement ? (
                  <div className="space-y-1 pl-2">
                    {item.children.map((child) => {
                      const childHref = child.href.split("?")[0];
                      const childView = new URLSearchParams(child.href.split("?")[1] || "").get("view");
                      const active =
                        pathname === childHref &&
                        (adminView ? adminView === childView : true);

                      return (
                        <Link
                          key={child.href}
                          href={child.href}
                          aria-current={active ? "page" : undefined}
                          className={`flex items-center justify-between rounded-2xl px-3 py-3 text-sm font-medium transition ${
                            active
                              ? "bg-sky-50 text-sky-700 ring-1 ring-inset ring-sky-200"
                              : "text-slate-600 hover:bg-slate-100 hover:text-slate-950"
                          }`}
                          onClick={onMobileClose}
                        >
                          <span className="truncate">{child.label}</span>
                        </Link>
                      );
                    })}
                  </div>
                ) : null}
              </div>
            );
          }

          const active = isActive(pathname, item.href);
          const Icon = getIconForLabel(item.label);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={`group flex items-center gap-3 rounded-2xl px-3 py-3 text-sm font-medium transition ${
                active
                  ? "bg-sky-50 text-sky-700 ring-1 ring-inset ring-sky-200"
                  : "text-slate-600 hover:bg-slate-100 hover:text-slate-950"
              }`}
              onClick={onMobileClose}
            >
              <span
                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-[11px] font-semibold transition ${
                  active ? "bg-sky-600 text-white" : "bg-slate-100 text-slate-600 group-hover:bg-slate-200"
                }`}
              >
                <Icon className="h-4 w-4" strokeWidth={2} />
              </span>
              <span
                className={`truncate transition-all duration-200 ${
                  collapsed ? "lg:max-w-0 lg:overflow-hidden lg:opacity-0 lg:pointer-events-none" : "lg:max-w-full opacity-100"
                }`}
              >
                {item.label}
              </span>
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-slate-200 p-4">
        <button
          type="button"
          onClick={() => signOut({ redirectTo: "/login" })}
          className={`flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 ${
            collapsed ? "lg:px-2" : ""
          }`}
        >
          <span
            className={`hidden h-9 w-9 items-center justify-center rounded-xl bg-slate-900 text-base font-semibold text-white ${
              collapsed ? "lg:flex" : "lg:hidden"
            }`}
          >
            ↩
          </span>
          <span className={`transition-all duration-200 ${collapsed ? "lg:hidden" : "lg:inline"}`}>
            Logout
          </span>
        </button>
      </div>
    </aside>
  );

  return (
    <>
      <div className="hidden lg:fixed lg:inset-y-0 lg:left-0 lg:z-30 lg:block">{shell}</div>

      <AnimatePresence>
        {mobileOpen ? (
          <>
            <motion.button
              type="button"
              aria-label="Close menu"
              className="fixed inset-0 z-40 bg-slate-950/40 lg:hidden"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={onMobileClose}
            />
            <motion.div
              className="fixed inset-y-0 left-0 z-50 w-[84vw] max-w-sm lg:hidden"
              initial={{ x: -320 }}
              animate={{ x: 0 }}
              exit={{ x: -320 }}
              transition={{ type: "spring", stiffness: 260, damping: 28 }}
            >
              {shell}
            </motion.div>
          </>
        ) : null}
      </AnimatePresence>
    </>
  );
}
