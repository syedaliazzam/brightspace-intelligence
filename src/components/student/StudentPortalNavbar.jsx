"use client";

import { signOut } from "next-auth/react";
import { useEffect, useMemo, useState } from "react";

const NAV_ITEMS = [
  { id: "dashboard", label: "Dashboard" },
  { id: "calendar", label: "Calendar" },
  { id: "homework", label: "Homework" },
  { id: "attendance", label: "Attendance" },
  { id: "notes", label: "Notes" },
  { id: "profile", label: "Profile" },
];

export default function StudentPortalNavbar({ profile = {} }) {
  const [activeId, setActiveId] = useState("dashboard");
  const [menuOpen, setMenuOpen] = useState(false);
  const [showTopButton, setShowTopButton] = useState(false);
  const ids = useMemo(() => NAV_ITEMS.map((item) => item.id), []);

  useEffect(() => {
    const sections = ids.map((id) => document.getElementById(id)).filter(Boolean);
    if (!sections.length) return undefined;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((entry) => entry.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (visible?.target?.id) setActiveId(visible.target.id);
        if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 8) setActiveId("profile");
      },
      { rootMargin: "-20% 0px -60% 0px", threshold: [0.12, 0.25, 0.5, 0.75] }
    );
    sections.forEach((section) => observer.observe(section));
    return () => observer.disconnect();
  }, [ids]);

  useEffect(() => {
    function handleResize() {
      if (window.innerWidth >= 1100) setMenuOpen(false);
    }
    function handleScroll() {
      setShowTopButton(window.scrollY > 480);
      if (window.innerHeight + window.scrollY >= document.body.offsetHeight - 8) setActiveId("profile");
    }
    handleResize();
    handleScroll();
    window.addEventListener("resize", handleResize);
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => {
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("scroll", handleScroll);
    };
  }, []);

  function scrollToSection(id) {
    const target = document.getElementById(id);
    if (!target) return;
    target.scrollIntoView({ behavior: "smooth", block: "start" });
    setActiveId(id);
  }

  function scrollToTop() {
    window.scrollTo({ top: 0, behavior: "smooth" });
    setActiveId("dashboard");
    setMenuOpen(false);
  }

  function handleNavClick(id) {
    setMenuOpen(false);
    scrollToSection(id);
  }

  const shell = "border-[#2D8A6A]/15 bg-white/85 backdrop-blur-xl";
  const activePill = "bg-[linear-gradient(135deg,#C9A227,#E4C766)] text-[#063F32] shadow-[0_10px_24px_-14px_rgba(201,162,39,0.6)]";
  const inactivePill = "bg-[#FAF7F0] text-[#245C4F] hover:bg-[#F1EADC]";

  return (
    <>
      <div className={`sticky top-0 z-30 border-b ${shell}`}>
        <div className="mx-auto max-w-7xl px-4 py-3 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between gap-3">
            <button type="button" onClick={scrollToTop} className="flex min-w-0 items-center gap-3 text-left">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[linear-gradient(135deg,#0D3B2E,#0D5C48)] text-base font-bold text-[#FFF5D6] shadow-[0_12px_24px_-12px_rgba(13,59,46,0.5)]">
                LMS
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-[#063F32]">Learning Portal</p>
                <p className="text-xs text-[#245C4F]">Student dashboard</p>
              </div>
            </button>

            <div className="hidden flex-1 items-center justify-center gap-2 min-[1100px]:flex">
              {NAV_ITEMS.map((item) => {
                const active = activeId === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleNavClick(item.id)}
                    className={`rounded-full px-4 py-2 text-sm font-semibold transition ${active ? activePill : inactivePill}`}
                  >
                    {item.label}
                  </button>
                );
              })}
            </div>

            <div className="hidden items-center gap-3 min-[1100px]:flex">
              <div className="text-right">
                <p className="text-sm font-semibold text-[#063F32]">{profile?.full_name || profile?.name || "Student"}</p>
                <p className="text-xs text-[#245C4F]">{profile?.username || profile?.email || "Student"}</p>
              </div>
              <button
                type="button"
                onClick={() => signOut({ callbackUrl: "/login" })}
                className="rounded-full border border-[#2D8A6A]/20 bg-white px-4 py-2 text-sm font-semibold text-[#0D5C48] transition hover:border-[#C9A227]/40 hover:bg-[#FFF5D6]"
              >
                Logout
              </button>
            </div>

            <div className="min-[1100px]:hidden">
              <button
                type="button"
                onClick={() => setMenuOpen((current) => !current)}
                className="rounded-full border border-[#2D8A6A]/20 bg-white px-4 py-2 text-sm font-semibold text-[#0D5C48] transition hover:border-[#C9A227]/40 hover:bg-[#FFF5D6]"
              >
                Menu
              </button>
            </div>
          </div>

          {menuOpen ? (
            <div className="mt-3 rounded-3xl border border-[#2D8A6A]/15 bg-white/95 p-4 shadow-lg min-[1100px]:hidden">
              <div className="grid gap-2">
                <div className="rounded-2xl bg-[#FAF7F0] p-3 sm:hidden">
                  <p className="text-sm font-semibold text-[#063F32]">{profile?.full_name || profile?.name || "Student"}</p>
                  <p className="text-xs text-[#245C4F]">{profile?.username || profile?.email || "Student"}</p>
                </div>
                {NAV_ITEMS.map((item) => {
                  const active = activeId === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => handleNavClick(item.id)}
                      className={`flex items-center justify-between rounded-2xl px-4 py-3 text-left text-sm font-semibold transition ${active ? activePill : inactivePill}`}
                    >
                      <span>{item.label}</span>
                      {active ? <span className="text-xs">Active</span> : null}
                    </button>
                  );
                })}
                <button
                  type="button"
                  onClick={() => signOut({ callbackUrl: "/login" })}
                  className="mt-2 rounded-2xl border border-[#2D8A6A]/20 bg-white px-4 py-3 text-left text-sm font-semibold text-[#0D5C48] transition hover:border-[#C9A227]/40 hover:bg-[#FFF5D6]"
                >
                  Logout
                </button>
              </div>
            </div>
          ) : null}
        </div>
      </div>

      {showTopButton ? (
        <button
          type="button"
          onClick={scrollToTop}
          aria-label="Scroll to top"
          className="fixed bottom-6 right-6 z-50 flex h-12 w-12 items-center justify-center rounded-full bg-[linear-gradient(135deg,#0D3B2E,#0D5C48)] text-[#FFF5D6] shadow-lg transition hover:brightness-110"
        >
          ↑
        </button>
      ) : null}
    </>
  );
}
