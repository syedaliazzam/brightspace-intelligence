import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";

const ALLOWED_ROLES = new Set(["admin", "coordinator"]);

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
        COALESCE(
          NULLIF(TRIM(istd.parent_name), ''),
          NULLIF(TRIM(rl.parent_name), ''),
          NULLIF(TRIM(rl.father_name_english), ''),
          NULLIF(TRIM(rl.mother_name_english), '')
        ) AS parent_name,
        COALESCE(
          NULLIF(TRIM(istd.child_name), ''),
          NULLIF(TRIM(istd.student_name), ''),
          NULLIF(TRIM(rl.student_name), '')
        ) AS child_name,
        COALESCE(
          NULLIF(TRIM(istd.student_name), ''),
          NULLIF(TRIM(istd.child_name), ''),
          NULLIF(TRIM(rl.student_name), '')
        ) AS student_name,
        COALESCE(
          NULLIF(TRIM(istd.email), ''),
          NULLIF(TRIM(rl.email), ''),
          NULLIF(TRIM(rl.father_email), ''),
          NULLIF(TRIM(rl.mother_email), '')
        ) AS email,
        COALESCE(
          NULLIF(TRIM(istd.phone), ''),
          NULLIF(TRIM(rl.phone), ''),
          NULLIF(TRIM(rl.father_contact_whatsapp), ''),
          NULLIF(TRIM(rl.mother_contact_whatsapp), '')
        ) AS phone,
        COALESCE(
          NULLIF(TRIM(istd.class_level), ''),
          NULLIF(TRIM(istd.class_applying_for), ''),
          NULLIF(TRIM(rl.class_level), '')
        ) AS class_level,
        COALESCE(
          NULLIF(TRIM(istd.child_age), ''),
          NULLIF(TRIM(rl.age::text), '')
        ) AS student_age,
        COALESCE(
          NULLIF(TRIM(istd.city_country), ''),
          NULLIF(TRIM(rl.city_country), ''),
          NULLIF(TRIM(rl.city), ''),
          NULLIF(TRIM(CONCAT_WS(', ', NULLIF(TRIM(rl.city), ''), NULLIF(TRIM(rl.country), ''))), '')
        ) AS city_country,
        COALESCE(
          NULLIF(TRIM(istd.message), ''),
          NULLIF(TRIM(istd.why_interested), ''),
          NULLIF(TRIM(istd.questions_comments), ''),
          NULLIF(TRIM(rl.interest_reason), ''),
          NULLIF(TRIM(istd.notes), ''),
          NULLIF(TRIM(rl.notes), '')
        ) AS message,
        COALESCE(istd.source, rl.source, '') AS source,
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
        COALESCE(NULLIF(TRIM(istd.notes), ''), NULLIF(TRIM(rl.notes), '')) AS notes,
        istd.created_at,
        istd.updated_at
      FROM interested_students istd
      LEFT JOIN registration_leads rl
        ON rl.id = istd.registration_lead_id
      ORDER BY istd.created_at DESC NULLS LAST, istd.id DESC
    `;

    return json("Interested students fetched.", 200, { items });
  } catch (error) {
    return json(error instanceof Error ? error.message : "Unable to fetch interested students.", 500);
  }
}
