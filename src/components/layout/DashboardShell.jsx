"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { usePathname } from "next/navigation";
import Sidebar from "@/components/layout/Sidebar";
import Topbar from "@/components/layout/Topbar";
import { getNavigationForRole, roleMeta } from "@/config/navigation";

export default function DashboardShell({ session, children }) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const role = String(session?.user?.role || "student").toLowerCase();
  const roleLabel = roleMeta[role]?.label || "Student";
  const nav = getNavigationForRole(role);
  const isAdmin = role === "admin";
  const isCoordinator = role === "coordinator";

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!mobileOpen) {
      return undefined;
    }

    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [mobileOpen]);

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#f8fbff_0%,#eef4ff_100%)] text-slate-900">
      <Sidebar
        session={session}
        mobileOpen={mobileOpen}
        onMobileClose={() => setMobileOpen(false)}
        collapsed={collapsed}
        onToggleCollapsed={() => setCollapsed((value) => !value)}
      />

      <Topbar
        session={session}
        onMenuClick={() => setMobileOpen(true)}
        onToggleCollapsed={() => setCollapsed((value) => !value)}
        collapsed={collapsed}
      />

      <main className={`pt-24 transition-[padding] duration-200 ${collapsed ? "lg:pl-20" : "lg:pl-72"}`}>
        <div className="px-4 pb-10 sm:px-6 lg:px-8">
          <motion.section
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35 }}
            className="rounded-[2rem] border border-white/70 bg-white/85 p-5 shadow-[0_24px_80px_-36px_rgba(15,23,42,0.25)] backdrop-blur-xl sm:p-8"
          >
            {!isAdmin && !isCoordinator ? (
              <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold uppercase tracking-[0.2em] text-sky-700">
                    {`${roleLabel} workspace`}
                  </p>
                  <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950 sm:text-3xl">
                    Protected dashboard shell
                  </h2>
                </div>

                <div className="rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-sm text-slate-600">
                  {`${nav.length} navigation items`}
                </div>
              </div>
            ) : null}

            {children ?? (
              <div className="grid gap-4 md:grid-cols-3">
                <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
                  <p className="text-sm font-semibold text-slate-950">Ready for role content</p>
                  <p className="mt-2 text-sm leading-6 text-slate-600">
                    This shell is in place for authenticated dashboards. Add business modules under each role route when ready.
                  </p>
                </div>
                <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
                  <p className="text-sm font-semibold text-slate-950">Navigation scaffold</p>
                  <p className="mt-2 text-sm leading-6 text-slate-600">
                    Sidebar and topbar are responsive, role-aware, and ready to host future pages.
                  </p>
                </div>
                <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
                  <p className="text-sm font-semibold text-slate-950">Session protected</p>
                  <p className="mt-2 text-sm leading-6 text-slate-600">
                    Unauthenticated users are redirected to the login screen before they reach this layout.
                  </p>
                </div>
              </div>
            )}
          </motion.section>
        </div>
      </main>
    </div>
  );
}
