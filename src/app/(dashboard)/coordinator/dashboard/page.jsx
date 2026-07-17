"use client";

import { useEffect, useState } from "react";
import CoordinatorStatsCards from "@/components/coordinator/CoordinatorStatsCards";
import CoordinatorGoTopButton from "@/components/coordinator/CoordinatorGoTopButton";
import CoordinatorPortalSection from "@/components/coordinator/CoordinatorPortalSection";
import { OpenBookLoader } from "@/components/shared/AshShajrahLoaders";

const CACHE_KEY = "coordinator-dashboard";
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

function writeNamedCache(key, payload) {
  if (typeof window === "undefined") {
    return;
  }

  window.sessionStorage.setItem(
    key,
    JSON.stringify({ timestamp: Date.now(), payload })
  );
}

export default function CoordinatorDashboardPage() {
  const [state, setState] = useState({
    loading: true,
    error: "",
    stats: null,
    recentLectures: [],
    recentLeads: [],
    reports: null,
  });

  useEffect(() => {
    let active = true;

    async function load() {
      const cached = readCache();

      if (cached && active) {
          setState({
            loading: false,
            error: "",
            stats: cached.stats || null,
            recentLectures: cached.recentLectures || [],
            recentLeads: cached.recentLeads || [],
            reports: cached.reports || null,
          });
      }

      try {
        const response = await fetch("/api/coordinator/dashboard", { cache: "no-store" });
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data?.message || "Unable to load coordinator dashboard.");
        }

        if (active) {
          writeCache(data);
          setState({
            loading: false,
            error: "",
            stats: data.stats,
            recentLectures: data.recentLectures || [],
            recentLeads: data.recentLeads || [],
            reports: data.reports || null,
          });
        }
      } catch (error) {
        if (active) {
          setState({
            loading: false,
            error:
              error instanceof Error
                ? error.message
                : "Unable to load coordinator dashboard.",
            stats: null,
            recentLectures: [],
            recentLeads: [],
            reports: null,
          });
        }
      }
    }

    void load();
    return () => {
      active = false;
    };
  }, []);

  const stats = state.stats || {};
  const reportData = state.reports || null;

  return (
    <div className="min-h-screen space-y-6 bg-[#FAF7F0]">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(201,162,39,0.12),transparent_35%),radial-gradient(circle_at_top_right,rgba(45,138,106,0.12),transparent_32%),linear-gradient(180deg,#FAF7F0_0%,#F7F1E3_100%)]" />
      <div className="relative mx-auto max-w-7xl space-y-6 px-4 py-4 sm:px-6 lg:px-8">
      <section className="relative overflow-hidden rounded-[2rem] border border-[#2D8A6A]/15 bg-[linear-gradient(135deg,rgba(13,59,46,0.98),rgba(13,92,72,0.94))] p-6 text-[#FAF7F0] shadow-[0_24px_80px_-36px_rgba(13,59,46,0.32)] sm:p-8">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(228,198,102,0.12),transparent_28%),radial-gradient(circle_at_bottom_left,rgba(101,184,145,0.14),transparent_30%)]" />
        <div className="relative max-w-3xl">
          <p className="inline-flex rounded-full border border-[#FFF5D6]/30 bg-[#FFF5D6]/10 px-3 py-1 text-[0.65rem] font-semibold uppercase tracking-[0.24em] text-[#FFF5D6]">
            Coordinator dashboard
          </p>
          <h1 className="mt-4 font-display text-3xl font-bold tracking-tight text-[#FAF7F0] sm:text-4xl">
            Coordinator command center
          </h1>
          <p className="mt-3 text-sm leading-7 text-[#EAF6EF] sm:text-base">
            Review admission progress, voucher movement, and classroom activity from one concise coordinator view.
          </p>
        </div>
      </section>

      {state.error ? (
        <section className="rounded-[1.75rem] border border-rose-200 bg-rose-50 p-5 text-sm text-rose-700">
          {state.error}
        </section>
      ) : null}

      {state.loading ? (
        <OpenBookLoader
          title="Loading coordinator dashboard"
          subtitle="Fetching summary cards and recent activity..."
        />
      ) : null}

      <CoordinatorPortalSection
        id="summary"
        title="Coordinator Summary"
        description="Key operational counts in the same compact card style used across the portal."
        showBrand={false}
      >
        <CoordinatorStatsCards
          items={[
            { key: "newLeads", label: "Parent Interview Form Not Submitted", value: state.loading ? "..." : stats.newLeads || 0 },
            { key: "parentInterviewSubmitted", label: "Parent Interview Form Submitted", value: state.loading ? "..." : stats.parentInterviewSubmitted || 0 },
            { key: "pendingVouchers", label: "Pending vouchers", value: state.loading ? "..." : stats.pendingVouchers || 0 },
            { key: "pendingPaymentVerifications", label: "Pending payment verifications", value: state.loading ? "..." : stats.pendingPaymentVerifications || 0 },
            { key: "activeStudents", label: "Active students", value: state.loading ? "..." : stats.activeStudents || 0 },
          ]}
        />
      </CoordinatorPortalSection>
      <CoordinatorGoTopButton />
      </div>
    </div>
  );
}
