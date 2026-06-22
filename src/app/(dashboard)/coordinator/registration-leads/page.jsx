import { Prisma } from "@prisma/client";
import { redirect } from "next/navigation";
import CoordinatorPortalNavbar from "@/components/coordinator/CoordinatorPortalNavbar";
import RegistrationLeadFilters from "@/components/coordinator/RegistrationLeadFilters";
import RegistrationLeadTable from "@/components/coordinator/RegistrationLeadTable";
import ShowMoreSection from "@/components/coordinator/ShowMoreSection";
import { auth, roleToDashboard } from "@/lib/auth";
import prisma from "@/lib/prisma";

const ALLOWED_ROLES = new Set(["admin", "coordinator"]);
const VALID_STATUSES = new Set([
  "new_lead",
  "voucher_created",
  "fee_submitted",
  "fee_verified",
  "access_granted",
  "rejected",
  "pending_clarification",
]);

function normalizeSearch(value) {
  return typeof value === "string" ? value.trim() : "";
}

async function getLeads(status, search) {
  const conditions = [];
  const values = [];

  if (status && VALID_STATUSES.has(status)) {
    values.push(status);
    conditions.push(`effective_status = $${values.length}`);
  }

  if (search) {
    const term = `%${search}%`;
    values.push(term);
    conditions.push(`(
        student_name ILIKE $${values.length}
        OR parent_name ILIKE $${values.length}
        OR email ILIKE $${values.length}
        OR phone ILIKE $${values.length}
      )`);
  }

  const whereClause = conditions.length
    ? `WHERE ${conditions.join(" AND ")}`
    : "";

  return prisma.$queryRawUnsafe(
    `
    WITH lead_rows AS (
      SELECT
        rl.*,
        EXISTS (
          SELECT 1
          FROM fee_vouchers fv
          WHERE fv.registration_id = rl.id
        ) AS has_voucher,
        CASE
          WHEN rl.status::text = 'voucher_created'
            AND NOT EXISTS (
              SELECT 1
              FROM fee_vouchers fv
              WHERE fv.registration_id = rl.id
            )
          THEN 'new_lead'
          ELSE LOWER(rl.status::text)
        END AS effective_status
      FROM registration_leads rl
    )
    SELECT
      id::text AS id,
      google_sheet_row_id,
      created_at AS submitted_at,
      student_name,
      parent_name,
      NULL::text AS parent_relation,
      email,
      phone,
      age AS student_age,
      class_level,
      subject_interest,
      preferred_schedule,
      address,
      NULL::text AS city,
      notes,
      source,
      has_voucher,
      effective_status AS status
    FROM lead_rows
    ${whereClause}
    ORDER BY updated_at DESC NULLS LAST, created_at DESC NULLS LAST, id DESC
    `,
    ...values
  );
}

export const dynamic = "force-dynamic";

export default async function CoordinatorRegistrationLeadsPage({ searchParams }) {
  const session = await auth();
  const role = String(session?.user?.role || "").toLowerCase();

  if (!session?.user || !ALLOWED_ROLES.has(role)) {
    redirect(session?.user ? roleToDashboard[role] || "/login" : "/login");
  }

  const resolvedParams = await searchParams;
  const search = normalizeSearch(resolvedParams?.search);
  const status = normalizeSearch(resolvedParams?.status).toLowerCase();
  const leads = await getLeads(status, search);

  return (
    <div className="space-y-6">
      <CoordinatorPortalNavbar profile={session.user} />
      <section className="rounded-[2rem] border border-white/70 bg-[linear-gradient(135deg,rgba(255,255,255,0.92),rgba(241,248,255,0.92))] p-6 shadow-[0_24px_80px_-36px_rgba(15,23,42,0.25)] sm:p-8">
        <p className="text-sm font-semibold uppercase tracking-[0.24em] text-sky-700">Registration leads</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">Google Sheet intake records</h1>
        <p className="mt-3 text-sm leading-7 text-slate-600 sm:text-base">
          Sync, review, and prepare registration leads for voucher creation.
        </p>
      </section>

      <RegistrationLeadFilters initialSearch={search} initialStatus={status} canSync />
      <ShowMoreSection
        items={leads}
        initialCount={10}
        step={10}
        renderItems={(visibleItems) => <RegistrationLeadTable leads={visibleItems} />}
        emptyMessage="No registration leads match the current filters."
      />
    </div>
  );
}
