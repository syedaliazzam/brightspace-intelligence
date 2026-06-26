"use client";

import { useEffect, useState } from "react";
import CoordinatorStatsCards from "@/components/coordinator/CoordinatorStatsCards";
import CoordinatorGoTopButton from "@/components/coordinator/CoordinatorGoTopButton";
import CoordinatorPortalSection from "@/components/coordinator/CoordinatorPortalSection";

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
    <div className="space-y-6 min-h-screen">
      {state.error ? (
        <section className="rounded-[1.75rem] border border-rose-200 bg-rose-50 p-5 text-sm text-rose-700">
          {state.error}
        </section>
      ) : null}

      <CoordinatorPortalSection
        id="summary"
        title="Coordinator Summary"
        description="Key operational counts in the same compact card style used across the portal."
        showBrand={false}
      >
        <CoordinatorStatsCards
          items={[
            { key: "newLeads", label: "New Admissions", value: state.loading ? "..." : stats.newLeads || 0 },
            { key: "pendingVouchers", label: "Pending vouchers", value: state.loading ? "..." : stats.pendingVouchers || 0 },
            { key: "pendingPaymentVerifications", label: "Pending payment verifications", value: state.loading ? "..." : stats.pendingPaymentVerifications || 0 },
            { key: "activeStudents", label: "Active students", value: state.loading ? "..." : stats.activeStudents || 0 },
          ]}
        />
      </CoordinatorPortalSection>
      <CoordinatorGoTopButton />
    </div>
  );
}
