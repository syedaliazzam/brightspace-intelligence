import { Prisma } from "@prisma/client";
import { redirect } from "next/navigation";
import RegistrationLeadFilters from "@/components/coordinator/RegistrationLeadFilters";
import RegistrationLeadTable from "@/components/coordinator/RegistrationLeadTable";
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

  if (status && VALID_STATUSES.has(status)) {
    conditions.push(Prisma.sql`LOWER(status::text) = ${status}`);
  }

  if (search) {
    const term = `%${search}%`;
    conditions.push(
      Prisma.sql`(
        student_name ILIKE ${term}
        OR parent_name ILIKE ${term}
        OR email ILIKE ${term}
        OR phone ILIKE ${term}
      )`
    );
  }

  const whereClause = conditions.length
    ? Prisma.sql`WHERE ${Prisma.join(conditions, Prisma.sql` AND `)}`
    : Prisma.empty;

  return prisma.$queryRaw`
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
      LOWER(status::text) AS status
    FROM registration_leads
    ${whereClause}
    ORDER BY created_at DESC NULLS LAST, id DESC
  `;
}

export const dynamic = "force-dynamic";

export default async function CoordinatorRegistrationLeadsPage({ searchParams }) {
  const session = await auth();
  const role = String(session?.user?.role || "").toLowerCase();

  if (!session?.user) {
    redirect("/login");
  }

  if (!ALLOWED_ROLES.has(role)) {
    redirect(roleToDashboard[role] || "/");
  }

  const filters = await searchParams;
  const search = normalizeSearch(filters?.search);
  const status = normalizeSearch(filters?.status).toLowerCase();
  const leads = await getLeads(status, search);

  return (
    <div className="space-y-6">
      <section className="rounded-[2rem] border border-white/70 bg-[linear-gradient(135deg,rgba(255,255,255,0.92),rgba(241,248,255,0.92))] p-6 shadow-[0_24px_80px_-36px_rgba(15,23,42,0.25)] sm:p-8">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-sky-700">
              Coordinator intake
            </p>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">
              Registration leads
            </h1>
            <p className="mt-3 text-sm leading-7 text-slate-600 sm:text-base">
              Sync intake data from Google Sheets, then manage the working lead list from PostgreSQL as the source of truth.
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white/80 px-4 py-3 text-sm text-slate-600">
            {leads.length} leads loaded
          </div>
        </div>
      </section>

      <RegistrationLeadFilters
        initialSearch={search}
        initialStatus={VALID_STATUSES.has(status) ? status : ""}
        canSync={role === "admin" || role === "coordinator"}
      />

      <RegistrationLeadTable leads={leads} />
    </div>
  );
}
