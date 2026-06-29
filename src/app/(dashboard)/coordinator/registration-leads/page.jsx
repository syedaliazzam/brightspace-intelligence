import { redirect } from "next/navigation";
import RegistrationLeadFilters from "@/components/coordinator/RegistrationLeadFilters";
import RegistrationLeadsPanel from "@/components/coordinator/RegistrationLeadsPanel";
import ShowMoreSectionServer from "@/components/coordinator/ShowMoreSectionServer";
import { auth, roleToDashboard } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { createSignedAdmissionDocumentUrl } from "@/lib/supabaseStorage";

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
    conditions.push(`LOWER(rl.status::text) = $${values.length}`);
  }

  if (search) {
    const term = `%${search}%`;
    values.push(term);
    conditions.push(`(
        student_name ILIKE $${values.length}
        OR parent_name ILIKE $${values.length}
        OR email ILIKE $${values.length}
        OR phone ILIKE $${values.length}
        OR COALESCE(rl.city_country, '') ILIKE $${values.length}
        OR COALESCE(rl.current_school, '') ILIKE $${values.length}
      )`);
  }

  const whereClause = conditions.length
    ? `WHERE ${conditions.join(" AND ")}`
    : "";

  return prisma.$queryRawUnsafe(
    `
    SELECT
      rl.id::text AS id,
      rl.created_at AS submitted_at,
      COALESCE(rl.program_name, '') AS program_name,
      COALESCE(rl.preferred_starting_month, '') AS preferred_starting_month,
      COALESCE(rl.preferred_starting_month_other, '') AS preferred_starting_month_other,
      rl.student_name,
      COALESCE(rl.student_name_urdu, '') AS student_name_urdu,
      COALESCE(rl.gender, '') AS gender,
      rl.date_of_birth,
      COALESCE(rl.country, '') AS country,
      COALESCE(rl.nationality, '') AS nationality,
      COALESCE(rl.religion, '') AS religion,
      COALESCE(rl.preferred_language, '') AS preferred_language,
      COALESCE(rl.current_school, '') AS current_school,
      COALESCE(rl.current_grade, '') AS current_grade,
      COALESCE(rl.shift_reason, '') AS shift_reason,
      COALESCE(rl.attended_online_classes, false) AS attended_online_classes,
      COALESCE(rl.child_profile, '') AS child_profile,
      COALESCE(rl.child_strengths, '') AS child_strengths,
      COALESCE(rl.child_support_needs, '') AS child_support_needs,
      COALESCE(rl.child_special_interests, '') AS child_special_interests,
      COALESCE(rl.developmental_concern, false) AS developmental_concern,
      COALESCE(rl.developmental_concern_details, '') AS developmental_concern_details,
      COALESCE(rl.medical_conditions, '') AS medical_conditions,
      rl.parent_name,
      rl.parent_relation,
      rl.email,
      rl.phone,
      rl.age AS student_age,
      rl.class_level,
      COALESCE(rl.city, '') AS city,
      COALESCE(rl.city_country, CONCAT_WS(', ', rl.city, '')) AS city_country,
      COALESCE(rl.interest_reason, '') AS interest_reason,
      COALESCE(rl.father_name_english, '') AS father_name_english,
      COALESCE(rl.father_name_urdu, '') AS father_name_urdu,
      COALESCE(rl.father_cnic, '') AS father_cnic,
      COALESCE(rl.father_qualification, '') AS father_qualification,
      COALESCE(rl.father_occupation, '') AS father_occupation,
      COALESCE(rl.father_mother_tongue, '') AS father_mother_tongue,
      COALESCE(rl.father_contact_home, '') AS father_contact_home,
      COALESCE(rl.father_contact_office, '') AS father_contact_office,
      COALESCE(rl.father_contact_whatsapp, '') AS father_contact_whatsapp,
      COALESCE(rl.father_emergency_contact, '') AS father_emergency_contact,
      COALESCE(rl.father_email, '') AS father_email,
      COALESCE(rl.father_residential_address, '') AS father_residential_address,
      COALESCE(rl.mother_name_english, '') AS mother_name_english,
      COALESCE(rl.mother_name_urdu, '') AS mother_name_urdu,
      COALESCE(rl.mother_cnic, '') AS mother_cnic,
      COALESCE(rl.mother_qualification, '') AS mother_qualification,
      COALESCE(rl.mother_occupation, '') AS mother_occupation,
      COALESCE(rl.mother_mother_tongue, '') AS mother_mother_tongue,
      COALESCE(rl.mother_contact_home, '') AS mother_contact_home,
      COALESCE(rl.mother_contact_office, '') AS mother_contact_office,
      COALESCE(rl.mother_contact_whatsapp, '') AS mother_contact_whatsapp,
      COALESCE(rl.mother_emergency_contact, '') AS mother_emergency_contact,
      COALESCE(rl.mother_email, '') AS mother_email,
      COALESCE(rl.mother_residential_address, '') AS mother_residential_address,
      COALESCE(rl.preferred_contact_person, '') AS preferred_contact_person,
      COALESCE(rl.support_person_during_learning, '') AS support_person_during_learning,
      COALESCE(rl.device_available, '') AS device_available,
      COALESCE(rl.school_expectations, '') AS school_expectations,
      COALESCE(rl.declaration_accepted, false) AS declaration_accepted,
      COALESCE(rl.birth_certificate_file_path, '') AS birth_certificate_file_path,
      COALESCE(rl.parent_cnic_file_path, '') AS parent_cnic_file_path,
      COALESCE(rl.child_photograph_file_path, '') AS child_photograph_file_path,
      COALESCE(rl.previous_school_report_file_path, '') AS previous_school_report_file_path,
      COALESCE(rl.medical_report_file_path, '') AS medical_report_file_path,
      COALESCE(rl.hear_about_source, '') AS hear_about_source,
      COALESCE(rl.hear_about_other, '') AS hear_about_other,
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

export default async function CoordinatorRegistrationLeadsPage({ searchParams }) {
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
  const leadsWithDocuments = await Promise.all(
    leads.map(async (lead) => ({
      ...lead,
      birth_certificate_file_url: lead.birth_certificate_file_path
        ? await createSignedAdmissionDocumentUrl(lead.birth_certificate_file_path).catch(() => "")
        : "",
      parent_cnic_file_url: lead.parent_cnic_file_path
        ? await createSignedAdmissionDocumentUrl(lead.parent_cnic_file_path).catch(() => "")
        : "",
      child_photograph_file_url: lead.child_photograph_file_path
        ? await createSignedAdmissionDocumentUrl(lead.child_photograph_file_path).catch(() => "")
        : "",
      previous_school_report_file_url: lead.previous_school_report_file_path
        ? await createSignedAdmissionDocumentUrl(lead.previous_school_report_file_path).catch(() => "")
        : "",
      medical_report_file_url: lead.medical_report_file_path
        ? await createSignedAdmissionDocumentUrl(lead.medical_report_file_path).catch(() => "")
        : "",
    }))
  );

  return (
    <div className="space-y-6 min-h-screen">
      <section className="rounded-[2rem] border border-white/70 bg-[linear-gradient(135deg,rgba(255,255,255,0.92),rgba(241,248,255,0.92))] p-6 shadow-[0_24px_80px_-36px_rgba(15,23,42,0.25)] sm:p-8">
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">Admission records of new students</h1>
        <p className="mt-3 text-sm leading-7 text-slate-600 sm:text-base">
          Review and prepare admission records for voucher creation.
        </p>
      </section>

      <RegistrationLeadFilters initialSearch={search} initialStatus={status} canSync={false} />
      <ShowMoreSectionServer
        items={leadsWithDocuments}
        page={page}
        pageSize={7}
        renderItems={(visibleItems) => <RegistrationLeadsPanel leads={visibleItems} />}
        emptyMessage="No admission records match the current filters."
        hrefBase="/coordinator/registration-leads"
      />
    </div>
  );
}
