import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";

const ALLOWED_ROLES = new Set(["superadmin", "admin", "coordinator"]);

function json(message, status = 200, extra = {}) {
  return NextResponse.json({ message, ...extra }, { status });
}

export async function GET() {
  const session = await auth();
  const role = String(session?.user?.role || "").toLowerCase();

  if (!session?.user) return json("Unauthorized.", 401);
  if (!ALLOWED_ROLES.has(role)) return json("Forbidden.", 403);

  try {
    const items = await prisma.$queryRaw`
      SELECT
        istd.id::text AS id,
        NULLIF(TRIM(istd.parent_name), '') AS parent_name,
        COALESCE(
          NULLIF(TRIM(istd.child_name), ''),
          NULLIF(TRIM(istd.student_name), '')
        ) AS child_name,
        COALESCE(
          NULLIF(TRIM(istd.student_name), ''),
          NULLIF(TRIM(istd.child_name), '')
        ) AS student_name,
        NULLIF(TRIM(istd.email), '') AS email,
        NULLIF(TRIM(istd.phone), '') AS phone,
        COALESCE(
          NULLIF(TRIM(istd.class_level), ''),
          NULLIF(TRIM(istd.class_applying_for), '')
        ) AS class_level,
        NULLIF(TRIM(istd.child_age), '') AS student_age,
        NULLIF(TRIM(istd.city_country), '') AS city_country,
        COALESCE(
          NULLIF(TRIM(istd.message), ''),
          NULLIF(TRIM(istd.why_interested), ''),
          NULLIF(TRIM(istd.questions_comments), ''),
          NULLIF(TRIM(istd.notes), '')
        ) AS message,
        COALESCE(istd.source, '') AS source,
        LOWER(istd.status::text) AS status,
        istd.admission_form_sent_at,
        istd.admission_form_due_at,
        istd.admission_form_last_reminder_at,
        istd.admission_form_reminder_count,
        LOWER(istd.admission_form_status::text) AS admission_form_status,
        istd.admission_form_submitted_at,
        istd.admission_form_last_channel,
        istd.admission_form_last_error,
        istd.registration_token,
        istd.registration_link_generated_at,
        istd.registration_link_generated_by::text AS registration_link_generated_by,
        istd.registration_lead_id::text AS registration_lead_id,
        pif.parent_interview_form_id,
        pif.parent_interview_status,
        pif.parent_interview_created_at,
        pif.parent_interview_submitted_at,
        pif.parent_interview_reviewed_at,
        NULLIF(TRIM(istd.notes), '') AS notes,
        istd.created_at,
        istd.updated_at
      FROM interested_students istd
      LEFT JOIN LATERAL (
        SELECT
          COUNT(*)::int AS parent_interview_count,
          COUNT(*) FILTER (
            WHERE LOWER(COALESCE(pif_inner.status::text, '')) IN ('submitted', 'reviewed')
              OR pif_inner.submitted_at IS NOT NULL
          )::int AS parent_interview_submitted_count,
          COUNT(*) FILTER (
            WHERE LOWER(COALESCE(pif_inner.status::text, '')) = 'sent'
          )::int AS parent_interview_sent_count,
          MAX(pif_inner.id)::text AS parent_interview_form_id,
          CASE
            WHEN COUNT(*) FILTER (
              WHERE LOWER(COALESCE(pif_inner.status::text, '')) IN ('submitted', 'reviewed')
                OR pif_inner.submitted_at IS NOT NULL
            ) > 0 THEN 'submitted'
            WHEN COUNT(*) FILTER (
              WHERE LOWER(COALESCE(pif_inner.status::text, '')) = 'sent'
            ) > 0 THEN 'sent'
            WHEN COUNT(*) > 0 THEN 'pending'
            ELSE NULL
          END AS parent_interview_status,
          MAX(pif_inner.created_at) AS parent_interview_created_at,
          MAX(pif_inner.submitted_at) AS parent_interview_submitted_at,
          MAX(pif_inner.reviewed_at) AS parent_interview_reviewed_at
        FROM parent_interview_forms pif_inner
        WHERE (
          NULLIF(TRIM(pif_inner.registration_id), '') = istd.registration_lead_id::text
          OR LOWER(NULLIF(TRIM(pif_inner.parent_email), '')) = LOWER(NULLIF(TRIM(istd.email), ''))
        )
      ) pif ON TRUE
      ORDER BY istd.created_at DESC NULLS LAST, istd.id DESC
    `;

    return json("Interested students fetched.", 200, { items });
  } catch (error) {
    return json(error instanceof Error ? error.message : "Unable to fetch interested students.", 500);
  }
}
