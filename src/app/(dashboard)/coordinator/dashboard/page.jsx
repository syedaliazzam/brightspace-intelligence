"use client";

import { useEffect, useState } from "react";
import CoordinatorStatsCards from "@/components/coordinator/CoordinatorStatsCards";
import CoordinatorPortalNavbar from "@/components/coordinator/CoordinatorPortalNavbar";
import CoordinatorPortalSection from "@/components/coordinator/CoordinatorPortalSection";
import ShowMoreSection from "@/components/coordinator/ShowMoreSection";
import RegistrationLeadFilters from "@/components/coordinator/RegistrationLeadFilters";
import RegistrationLeadTable from "@/components/coordinator/RegistrationLeadTable";
import FeeVoucherFilters from "@/components/coordinator/FeeVoucherFilters";
import FeeVoucherForm from "@/components/coordinator/FeeVoucherForm";
import FeeVoucherTable from "@/components/coordinator/FeeVoucherTable";
import PaymentVerificationTable from "@/components/coordinator/PaymentVerificationTable";
import StudentTable from "@/components/coordinator/StudentTable";
import ParentTable from "@/components/coordinator/ParentTable";
import TeacherAssignmentForm from "@/components/coordinator/TeacherAssignmentForm";
import TeacherAssignmentTable from "@/components/coordinator/TeacherAssignmentTable";
import LectureScheduleForm from "@/components/coordinator/LectureScheduleForm";
import LectureScheduleTable from "@/components/coordinator/LectureScheduleTable";
import LectureVerificationTable from "@/components/coordinator/LectureVerificationTable";
import CoordinatorReportsPanel from "@/components/coordinator/CoordinatorReportsPanel";

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
    leads: [],
    vouchers: [],
    payments: [],
    students: [],
    parents: [],
    assignments: [],
    schedules: [],
    verifications: [],
    voucherLeads: [],
    assignmentOptions: { teachers: [], students: [], courses: [], subjects: [] },
    scheduleOptions: { students: [], enrollments: [], subjects: [], teachers: [], items: [] },
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
          leads: cached.leads || [],
          vouchers: cached.vouchers || [],
          payments: cached.payments || [],
          students: cached.students || [],
          parents: cached.parents || [],
          assignments: cached.assignments || [],
          schedules: cached.schedules || [],
          verifications: cached.verifications || [],
          voucherLeads: cached.voucherLeads || [],
          assignmentOptions: cached.assignmentOptions || { teachers: [], students: [], courses: [], subjects: [] },
          scheduleOptions: cached.scheduleOptions || { students: [], enrollments: [], subjects: [], teachers: [], items: [] },
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
            leads: [],
            vouchers: [],
            payments: [],
            students: [],
            parents: [],
            assignments: [],
            schedules: [],
            verifications: [],
            voucherLeads: [],
            assignmentOptions: { teachers: [], students: [], courses: [], subjects: [] },
            scheduleOptions: { students: [], enrollments: [], subjects: [], teachers: [], items: [] },
          });
        }

        void Promise.allSettled([
          fetch("/api/coordinator/students", { cache: "no-store" })
            .then((result) => result.json())
            .then((payload) => {
              writeNamedCache("coordinator-students:", payload);
              if (active) setState((current) => ({ ...current, students: payload.items || [] }));
            }),
          fetch("/api/coordinator/parents", { cache: "no-store" })
            .then((result) => result.json())
            .then((payload) => {
              writeNamedCache("coordinator-parents:", payload);
              if (active) setState((current) => ({ ...current, parents: payload.items || [] }));
            }),
          fetch("/api/coordinator/teacher-assignments", { cache: "no-store" })
            .then((result) => result.json())
            .then((payload) => {
              writeNamedCache("coordinator-teacher-assignments", payload);
              if (active) setState((current) => ({ ...current, assignments: payload.items || [], assignmentOptions: payload }));
            }),
          fetch("/api/coordinator/lecture-schedules", { cache: "no-store" })
            .then((result) => result.json())
            .then((payload) => {
              writeNamedCache("coordinator-lecture-schedules", payload);
              if (active) setState((current) => ({ ...current, schedules: payload.items || [], scheduleOptions: payload }));
            }),
          fetch("/api/coordinator/lecture-verifications?status=pending", { cache: "no-store" })
            .then((result) => result.json())
            .then((payload) => {
              writeNamedCache("coordinator-lecture-verifications:pending", payload);
              if (active) setState((current) => ({ ...current, verifications: payload.items || [] }));
            }),
          fetch("/api/coordinator/reports", { cache: "no-store" })
            .then((result) => result.json())
            .then((payload) => {
              writeNamedCache("coordinator-reports", payload);
              if (active) {
                setState((current) => ({ ...current, reports: payload }));
              }
            }),
          fetch("/api/coordinator/registration-leads", { cache: "no-store" })
            .then((result) => result.json())
            .then((payload) => {
              writeNamedCache("coordinator-registration-leads", payload);
              if (active) setState((current) => ({ ...current, leads: payload.items || [] }));
            }),
          fetch("/api/coordinator/fee-vouchers", { cache: "no-store" })
            .then((result) => result.json())
            .then((payload) => {
              writeNamedCache("coordinator-fee-vouchers", payload);
              if (active) setState((current) => ({ ...current, vouchers: payload.items || [], voucherLeads: payload.eligibleLeads || [] }));
            }),
          fetch("/api/coordinator/payments", { cache: "no-store" })
            .then((result) => result.json())
            .then((payload) => {
              writeNamedCache("coordinator-payments", payload);
              if (active) setState((current) => ({ ...current, payments: payload.items || [] }));
            }),
        ]);
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
            leads: [],
            vouchers: [],
            payments: [],
            students: [],
            parents: [],
            assignments: [],
            schedules: [],
            verifications: [],
            voucherLeads: [],
            assignmentOptions: { teachers: [], students: [], courses: [], subjects: [] },
            scheduleOptions: { students: [], enrollments: [], subjects: [], teachers: [], items: [] },
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
    <div className="space-y-6">
      <CoordinatorPortalNavbar />
      <CoordinatorPortalSection
        id="dashboard"
        title="Dashboard"
        description="Monitor intake, payments, access approvals, teacher activity, and lecture scheduling from one coordinated portal."
      >
      </CoordinatorPortalSection>

      {state.error ? (
        <section className="rounded-[1.75rem] border border-rose-200 bg-rose-50 p-5 text-sm text-rose-700">
          {state.error}
        </section>
      ) : null}

      <CoordinatorPortalSection
        id="summary"
        title="Coordinator Summary"
        description="Key operational counts in the same compact card style used across the portal."
      >
        <CoordinatorStatsCards
          items={[
            { key: "newLeads", label: "New leads", value: state.loading ? "..." : stats.newLeads || 0 },
            { key: "pendingVouchers", label: "Pending vouchers", value: state.loading ? "..." : stats.pendingVouchers || 0 },
            { key: "pendingPaymentVerifications", label: "Pending payment verifications", value: state.loading ? "..." : stats.pendingPaymentVerifications || 0 },
            { key: "activeStudents", label: "Active students", value: state.loading ? "..." : stats.activeStudents || 0 },
            { key: "todayClasses", label: "Today classes", value: state.loading ? "..." : stats.todayClasses || 0 },
            { key: "classesNeedingVerification", label: "Classes needing verification", value: state.loading ? "..." : stats.classesNeedingVerification || 0 },
            { key: "missedClasses", label: "Missed classes", value: state.loading ? "..." : stats.missedClasses || 0 },
            { key: "rescheduledClasses", label: "Rescheduled classes", value: state.loading ? "..." : stats.rescheduledClasses || 0 },
          ]}
        />
      </CoordinatorPortalSection>

      <CoordinatorPortalSection
        id="registration-leads"
        title="Registration Leads"
        description="Latest intake and pipeline summary."
      >
        <div className="space-y-4">
          <RegistrationLeadFilters initialSearch="" initialStatus="" canSync={true} />
          <ShowMoreSection
            items={state.leads}
            renderItems={(visibleItems) => <RegistrationLeadTable leads={visibleItems} />}
            emptyMessage="No registration leads match the current filters."
          />
        </div>
      </CoordinatorPortalSection>

      <CoordinatorPortalSection id="fee-vouchers" title="Fee Vouchers" description="Billing and voucher issuance.">
        <div className="space-y-4">
          <FeeVoucherFilters initialSearch="" initialStatus="" />
          <FeeVoucherForm leads={state.voucherLeads} />
          <ShowMoreSection
            items={state.vouchers}
            renderItems={(visibleItems) => <FeeVoucherTable vouchers={visibleItems} />}
            emptyMessage="No fee vouchers match the current filters."
          />
        </div>
      </CoordinatorPortalSection>

      <CoordinatorPortalSection id="payments" title="Payments" description="Verification queue.">
        <ShowMoreSection
          items={state.payments}
          renderItems={(visibleItems) => <PaymentVerificationTable items={visibleItems} />}
          emptyMessage="No payment submissions match the current filter."
        />
      </CoordinatorPortalSection>

      <CoordinatorPortalSection id="students" title="Students" description="Learner registry.">
        <ShowMoreSection
          items={state.students}
          renderItems={(visibleItems) => <StudentTable items={visibleItems} />}
          emptyMessage="No student records available."
        />
      </CoordinatorPortalSection>

      <CoordinatorPortalSection id="parents" title="Parents" description="Family registry.">
        <ShowMoreSection
          items={state.parents}
          renderItems={(visibleItems) => <ParentTable items={visibleItems} />}
          emptyMessage="No parent records available."
        />
      </CoordinatorPortalSection>

      <CoordinatorPortalSection id="teacher-assignments" title="Teacher Assignments" description="Assignment workspace.">
        <div className="space-y-4">
          <TeacherAssignmentForm options={state.assignmentOptions} onSuccess={() => window.location.reload()} />
          <ShowMoreSection
            items={state.assignments}
            renderItems={(visibleItems) => <TeacherAssignmentTable items={visibleItems} />}
            emptyMessage="No teacher assignments available."
          />
        </div>
      </CoordinatorPortalSection>

      <CoordinatorPortalSection id="lecture-scheduler" title="Lecture Scheduler" description="Scheduling workspace.">
        <div className="space-y-4">
          <LectureScheduleForm options={state.scheduleOptions} onSuccess={() => window.location.reload()} />
          <ShowMoreSection
            items={state.schedules}
            renderItems={(visibleItems) => <LectureScheduleTable items={visibleItems} />}
            emptyMessage="No lecture schedules available."
          />
        </div>
      </CoordinatorPortalSection>

      <CoordinatorPortalSection id="lecture-verification" title="Lecture Verification" description="Verification queue.">
        <ShowMoreSection
          items={state.verifications}
          renderItems={(visibleItems) => <LectureVerificationTable items={visibleItems} />}
          emptyMessage="No lecture verification records available."
        />
      </CoordinatorPortalSection>

      <CoordinatorPortalSection id="reports" title="Reports" description="Operational reports.">
        <CoordinatorReportsPanel data={reportData || state.recentReportData || {}} />
      </CoordinatorPortalSection>

      <section className="grid gap-6 xl:grid-cols-2">
        <div className="rounded-[1.75rem] border border-white/70 bg-white/90 p-5 shadow-[0_20px_70px_-36px_rgba(15,23,42,0.25)]">
          <p className="text-sm font-semibold uppercase tracking-[0.22em] text-sky-700">Recent lectures</p>
          <div className="mt-4 space-y-3">
            {state.recentLectures.length ? state.recentLectures.map((item) => (
              <div key={item.id} className="rounded-2xl bg-slate-50 px-4 py-3">
                <p className="font-semibold text-slate-950">{item.title}</p>
                <p className="mt-1 text-sm text-slate-600">{item.student_name} with {item.teacher_name}</p>
                <p className="mt-1 text-xs text-slate-500">{item.status}</p>
              </div>
            )) : <p className="text-sm text-slate-500">No lecture activity available.</p>}
          </div>
        </div>

        <div className="rounded-[1.75rem] border border-white/70 bg-white/90 p-5 shadow-[0_20px_70px_-36px_rgba(15,23,42,0.25)]">
          <p className="text-sm font-semibold uppercase tracking-[0.22em] text-sky-700">Recent leads</p>
          <div className="mt-4 space-y-3">
            {state.recentLeads.length ? state.recentLeads.map((item) => (
              <div key={item.id} className="rounded-2xl bg-slate-50 px-4 py-3">
                <p className="font-semibold text-slate-950">{item.student_name}</p>
                <p className="mt-1 text-sm text-slate-600">{item.parent_name || "Parent pending"}</p>
                <p className="mt-1 text-xs text-slate-500">{item.status}</p>
              </div>
            )) : <p className="text-sm text-slate-500">No lead activity available.</p>}
          </div>
        </div>
      </section>
    </div>
  );
}
