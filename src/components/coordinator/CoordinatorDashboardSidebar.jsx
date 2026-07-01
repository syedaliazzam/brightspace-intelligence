"use client";

import { AnimatePresence, motion } from "framer-motion";
import { signOut } from "next-auth/react";
import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  UserCog,
  ReceiptText,
  BadgeDollarSign,
  CreditCard,
  GraduationCap,
  UserRound,
  CalendarDays,
  ClipboardCheck,
  FileText,
} from "lucide-react";

const NAV_ITEMS = [
  { label: "Dashboard / Overview", href: "/coordinator/dashboard", icon: LayoutDashboard, tone: "bg-slate-100 text-slate-700" },
  { label: "Interested Students", href: "/coordinator/interested-students", icon: Users, tone: "bg-emerald-100 text-emerald-700" },
  { label: "Registration Leads", href: "/coordinator/registration-leads", icon: UserCog, tone: "bg-sky-100 text-sky-700" },
  { label: "Fee Vouchers", href: "/coordinator/fee-vouchers", icon: ReceiptText, tone: "bg-amber-100 text-amber-700" },
  { label: "Regular Fee Vouchers", href: "/coordinator/regular-fee-vouchers", icon: BadgeDollarSign, tone: "bg-emerald-100 text-emerald-700" },
  { label: "Payments", href: "/coordinator/payments", icon: CreditCard, tone: "bg-violet-100 text-violet-700" },
  { label: "Students", href: "/coordinator/students", icon: GraduationCap, tone: "bg-teal-100 text-teal-700" },
  { label: "Parents", href: "/coordinator/parents", icon: UserRound, tone: "bg-fuchsia-100 text-fuchsia-700" },
  { label: "Teacher Assignments", href: "/coordinator/teacher-assignments", icon: UserCog, tone: "bg-orange-100 text-orange-700" },
  { label: "Lecture Scheduler", href: "/coordinator/lecture-schedules", icon: CalendarDays, tone: "bg-indigo-100 text-indigo-700" },
  { label: "Lecture Verification", href: "/coordinator/lecture-verifications", icon: ClipboardCheck, tone: "bg-rose-100 text-rose-700" },
  { label: "Reports", href: "/coordinator/reports", icon: FileText, tone: "bg-lime-100 text-lime-700" },
];

function isActive(pathname, href) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

function getInitials(value) {
  return String(value || "C")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

function NavIcon({ Icon, active, tone }) {
  const className = active ? "h-4 w-4 text-white" : `h-4 w-4 ${tone?.split(" ").slice(1).join(" ") || "text-slate-700"}`;
  return <Icon className={className} strokeWidth={2} />;
}

export default function CoordinatorDashboardSidebar({ profile }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    function handleResize() {
      if (window.innerWidth >= 1100) setMobileOpen(false);
    }

    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const shell = (
    <aside className="flex h-full w-72 flex-col border-r border-slate-200 bg-white/95 shadow-[0_18px_60px_-40px_rgba(15,23,42,0.45)] backdrop-blur-xl">
      <div className="border-b border-slate-200 px-5 py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-transparent">
            <Image src="/ash-shajrah-logo.webp" alt="Ash-Shajrah Learning Hub" width={44} height={44} className="h-full w-full object-contain" priority />
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-slate-950">Coordinator Portal</p>
            <p className="truncate text-xs text-slate-500">{profile?.email || "coordinator@lms.local"}</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
        {NAV_ITEMS.map((item) => {
          const active = isActive(pathname, item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setMobileOpen(false)}
              className={`flex items-center gap-3 rounded-2xl px-3 py-3 text-sm font-medium transition ${
                active
                  ? "bg-sky-50 text-sky-700 ring-1 ring-inset ring-sky-200"
                  : "text-slate-600 hover:bg-slate-100 hover:text-slate-950"
              }`}
            >
              <span
                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition ${
                  active ? "bg-slate-950 text-white" : item.tone
                }`}
              >
                <NavIcon Icon={item.icon} active={active} tone={item.tone} />
              </span>
              <span className="truncate">{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-slate-200 p-4">
        <button
          type="button"
          onClick={() => signOut({ callbackUrl: "/login" })}
          className="flex w-full items-center justify-center rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
        >
          Logout
        </button>
      </div>
    </aside>
  );

  return (
    <>
      <div className="hidden lg:fixed lg:inset-y-0 lg:left-0 lg:z-30 lg:block">{shell}</div>

      <div className="sticky top-0 z-30 border-b border-white/70 bg-white/80 backdrop-blur-xl lg:hidden">
        <div className="flex items-center justify-between px-4 py-3 sm:px-6">
          <Link
            href="/coordinator/dashboard"
            onClick={() => setMobileOpen(false)}
            className="flex items-center gap-3 text-left"
          >
            <div className="flex h-11 w-11 items-center justify-center overflow-hidden rounded-2xl bg-transparent">
              <Image src="/ash-shajrah-logo.webp" alt="Ash-Shajrah Learning Hub" width={44} height={44} className="h-full w-full object-contain" priority />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-950">Coordinator Portal</p>
              <p className="text-xs text-slate-500">{profile?.email || "coordinator@lms.local"}</p>
            </div>
          </Link>

          <button
            type="button"
            onClick={() => setMobileOpen((current) => !current)}
            className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
          >
            Menu
          </button>
        </div>
      </div>

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
              onClick={() => setMobileOpen(false)}
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
