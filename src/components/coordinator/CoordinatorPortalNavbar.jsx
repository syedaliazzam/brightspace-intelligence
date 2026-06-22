"use client";

import { useEffect, useMemo, useState } from "react";

const NAV_ITEMS = [
  { id: "dashboard", label: "Dashboard" },
  { id: "registration-leads", label: "Registration Leads" },
  { id: "fee-vouchers", label: "Fee Vouchers" },
  { id: "payments", label: "Payments" },
  { id: "students", label: "Students" },
  { id: "parents", label: "Parents" },
  { id: "teacher-assignments", label: "Teacher Assignments" },
  { id: "lecture-scheduler", label: "Lecture Scheduler" },
  { id: "lecture-verification", label: "Lecture Verification" },
  { id: "reports", label: "Reports" },
];

export default function CoordinatorPortalNavbar({ profile = {} }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [navExpanded, setNavExpanded] = useState(false);
  const [activeId, setActiveId] = useState("dashboard");
  const ids = useMemo(() => NAV_ITEMS.map((item) => item.id), []);

  useEffect(() => {
    const sections = ids.map((id) => document.getElementById(id)).filter(Boolean);

    if (!sections.length) return undefined;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((entry) => entry.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (visible?.target?.id) setActiveId(visible.target.id);

        const nearBottom = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 8;
        if (nearBottom) setActiveId("reports");
      },
      { rootMargin: "-20% 0px -60% 0px", threshold: [0.12, 0.25, 0.5, 0.75] }
    );

    sections.forEach((section) => observer.observe(section));
    return () => observer.disconnect();
  }, [ids]);

  useEffect(() => {
    function handleResize() {
      if (window.innerWidth >= 1100) {
        setMenuOpen(false);
        setNavExpanded(false);
      }
    }

    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    function handleScroll() {
      if (window.innerHeight + window.scrollY >= document.body.offsetHeight - 8) {
        setActiveId("reports");
      }
    }

    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  function scrollToSection(id) {
    const target = document.getElementById(id);
    if (!target) return;
    target.scrollIntoView({ behavior: "smooth", block: "start" });
    setActiveId(id);
    setMenuOpen(false);
  }

  return (
    <div className="sticky top-0 z-30 border-b border-white/70 bg-white/80 backdrop-blur-xl">
      <div className="mx-auto max-w-7xl px-4 py-3 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between gap-3">
          <button type="button" onClick={() => scrollToSection("dashboard")} className="flex min-w-0 items-center gap-3 text-left">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-950 text-base font-bold text-white shadow-sm">
              LMS
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-slate-950">Coordinator Portal</p>
              <p className="text-xs text-slate-500">{profile?.email || "coordinator@lms.local"}</p>
            </div>
          </button>
          <div className="hidden min-[1100px]:flex min-[1100px]:flex-1 min-[1100px]:items-center min-[1100px]:justify-center min-[1100px]:gap-2">
            {NAV_ITEMS.slice(0, 4).map((item) => {
              const active = activeId === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => scrollToSection(item.id)}
                  className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                    active ? "bg-slate-950 text-white shadow" : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                  }`}
                >
                  {item.label}
                </button>
              );
            })}
            <div className="relative">
              <button
                type="button"
                onClick={() => setNavExpanded((current) => !current)}
                className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition ${
                  NAV_ITEMS.slice(4).some((item) => item.id === activeId)
                    ? "bg-slate-950 text-white shadow"
                    : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                }`}
              >
                More
                <span aria-hidden="true">{navExpanded ? "▴" : "▾"}</span>
              </button>

              {navExpanded ? (
                <div className="absolute right-0 top-[calc(100%+0.5rem)] z-40 w-64 rounded-3xl border border-slate-200 bg-white p-2 shadow-xl">
                  {NAV_ITEMS.slice(4).map((item) => {
                    const active = activeId === item.id;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => {
                          scrollToSection(item.id);
                          setNavExpanded(false);
                        }}
                        className={`flex w-full items-center justify-between rounded-2xl px-4 py-3 text-left text-sm font-semibold transition ${
                          active ? "bg-slate-950 text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                        }`}
                      >
                        <span>{item.label}</span>
                        {active ? <span className="text-xs">Active</span> : null}
                      </button>
                    );
                  })}
                </div>
              ) : null}
            </div>
          </div>
          <div className="hidden items-center gap-3 min-[1100px]:flex">
            <div className="text-right">
              <p className="text-sm font-semibold text-slate-950">{profile?.full_name || profile?.name || "Coordinator"}</p>
              <p className="text-xs text-slate-500">{profile?.email || profile?.role || "Operations"}</p>
            </div>
            <button
              type="button"
              onClick={() => window.location.assign("/login")}
              className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-100"
            >
              Logout
            </button>
          </div>

          <button
            type="button"
            onClick={() => setMenuOpen((current) => !current)}
            className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-100 min-[1100px]:hidden"
          >
            Menu
          </button>
        </div>

        {menuOpen ? (
          <div className="mt-3 grid gap-2 rounded-3xl border border-slate-200 bg-white p-4 shadow-lg min-[1100px]:hidden">
            <div className="rounded-2xl bg-slate-50 p-3 sm:hidden">
              <p className="text-sm font-semibold text-slate-950">{profile?.full_name || profile?.name || "Coordinator"}</p>
              <p className="text-xs text-slate-500">{profile?.email || "coordinator@lms.local"}</p>
            </div>
            {NAV_ITEMS.map((item) => {
              const active = activeId === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => scrollToSection(item.id)}
                  className={`rounded-2xl px-4 py-3 text-sm font-semibold transition ${
                    active ? "bg-slate-950 text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                  }`}
                >
                  {item.label}
                </button>
              );
            })}
            <button
              type="button"
              onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
              className="mt-2 rounded-2xl border border-slate-200 px-4 py-3 text-left text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-100"
            >
              Back to top
            </button>
            <button
              type="button"
              onClick={() => window.location.assign("/login")}
              className="rounded-2xl border border-slate-200 px-4 py-3 text-left text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-100 sm:hidden"
            >
              Logout
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
