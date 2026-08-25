import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";

const ALLOWED_ROLES = new Set(["superadmin", "admin"]);

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
        pif.id::text AS id,
        pif.registration_id,
        pif.parent_name,
        pif.parent_email,
        pif.child_name,
        pif.child_age,
        pif.interested_programme,
        LOWER(pif.status::text) AS status,
        pif.responses,
        pif.submitted_at,
        pif.reviewed_at,
        pif.form_version,
        pif.created_at,
        pif.updated_at,
        EXISTS (
          SELECT 1
          FROM enrollments e
          LEFT JOIN registration_leads rl ON rl.id = e.registration_id
          LEFT JOIN interested_students istd ON istd.registration_lead_id = e.registration_id
          WHERE LOWER(COALESCE(e.status::text, 'active')) = 'active'
            AND (
              e.registration_id::text = NULLIF(TRIM(pif.registration_id), '')
              OR NULLIF(TRIM(istd.registration_code), '') = NULLIF(TRIM(pif.registration_id), '')
              OR (
                LOWER(NULLIF(TRIM(pif.parent_email), '')) IN (
                  LOWER(NULLIF(TRIM(rl.email), '')),
                  LOWER(NULLIF(TRIM(istd.email), ''))
                )
                AND LOWER(NULLIF(TRIM(pif.child_name), '')) IN (
                  LOWER(NULLIF(TRIM(rl.student_name), '')),
                  LOWER(NULLIF(TRIM(istd.student_name), '')),
                  LOWER(NULLIF(TRIM(istd.child_name), ''))
                )
              )
            )
          LIMIT 1
        ) AS is_lms_enrolled
      FROM parent_interview_forms pif
      ORDER BY pif.created_at DESC NULLS LAST, pif.id DESC
    `;

    return json("Parent interview forms fetched.", 200, { items });
  } catch (error) {
    return json(error instanceof Error ? error.message : "Unable to fetch parent interview forms.", 500);
  }
}
