import { redirect } from "next/navigation";
import RegistrationLeadFilters from "@/components/coordinator/RegistrationLeadFilters";
import RegistrationLeadsPanel from "@/components/coordinator/RegistrationLeadsPanel";
import ShowMoreSectionServer from "@/components/coordinator/ShowMoreSectionServer";
import { auth, roleToDashboard } from "@/lib/auth";
import prisma from "@/lib/prisma";

const ALLOWED_ROLES = new Set(["admin"]);
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
    conditions.push(`LOWER(rl.status::text) = $${values.length}`);
  }

  if (search) {
    const term = `%${search}%`;
    values.push(term);
    conditions.push(`(
        rl.student_name ILIKE $${values.length}
        OR rl.parent_name ILIKE $${values.length}
        OR rl.email ILIKE $${values.length}
        OR rl.phone ILIKE $${values.length}
      )`);
  }

  const whereClause = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

  return prisma.$queryRawUnsafe(
    `
    SELECT
      rl.id::text AS id,
      rl.created_at AS submitted_at,
      rl.student_name,
      rl.parent_name,
      rl.parent_relation,
      rl.email,
      rl.phone,
      rl.age AS student_age,
      rl.class_level,
      rl.address,
      rl.city,
      rl.notes,
      COALESCE(rl.source::text, 'website_registration') AS source,
      EXISTS (
        SELECT 1
        FROM fee_vouchers fv
        WHERE fv.registration_id = rl.id
      ) AS has_voucher,
      CASE
        WHEN rl.status::text = 'new_lead'
         AND NOT EXISTS (
           SELECT 1
           FROM fee_vouchers fv
           WHERE fv.registration_id = rl.id
         )
        THEN true
        ELSE false
      END AS can_create_voucher,
      LOWER(rl.status::text) AS status
    FROM registration_leads rl
    ${whereClause}
    ORDER BY rl.created_at DESC NULLS LAST, rl.id DESC
    `,
    ...values
  );
}

export const dynamic = "force-dynamic";

export default async function AdminRegistrationLeadsPage({ searchParams }) {
  const session = await auth();
  const role = String(session?.user?.role || "").toLowerCase();

  if (!session?.user || !ALLOWED_ROLES.has(role)) {
    redirect(session?.user ? roleToDashboard[role] || "/login" : "/login");
  }

  const resolvedParams = await searchParams;
  const search = normalizeSearch(resolvedParams?.search);
  const statusParam = normalizeSearch(resolvedParams?.status).toLowerCase();
  const status = statusParam === "all" ? "" : statusParam || "new_lead";
  const page = Number(resolvedParams?.page || 1) || 1;
  const leads = await getLeads(status, search);

  return (
    <div className="space-y-6 min-h-screen">
      <section className="rounded-[2rem] border border-white/70 bg-[linear-gradient(135deg,rgba(255,255,255,0.92),rgba(241,248,255,0.92))] p-6 shadow-[0_24px_80px_-36px_rgba(15,23,42,0.25)] sm:p-8">
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">
          Admission records of new students
        </h1>
        <p className="mt-3 text-sm leading-7 text-slate-600 sm:text-base">
          Review submitted registration leads and track admission progress from the admin portal.
        </p>
      </section>

      <RegistrationLeadFilters initialSearch={search} initialStatus={status} canSync={false} />

      <ShowMoreSectionServer
        items={leads}
        page={page}
        pageSize={7}
        renderItems={(visibleItems) => <RegistrationLeadsPanel leads={visibleItems} />}
        emptyMessage="No admission records match the current filters."
        hrefBase="/admin/registration-leads"
      />
    </div>
  );
}
