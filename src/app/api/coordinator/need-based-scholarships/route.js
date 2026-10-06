import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";

const ALLOWED_ROLES = new Set(["admin", "coordinator", "superadmin"]);

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
        nbsf.id::text AS id,
        nbsf.registration_id::text AS registration_id,
        nbsf.interested_student_id::text AS interested_student_id,
        nbsf.lead_token,
        nbsf.dependents_count,
        nbsf.school_going_children_count,
        nbsf.residence_type,
        nbsf.requested_amount::float8 AS requested_amount,
        nbsf.scholarship_reason,
        LOWER(
          COALESCE(
            latest_submission.status::text,
            fv.status::text,
            CASE
              WHEN COALESCE(nbsf.voucher_created, FALSE) OR nbsf.voucher_id IS NOT NULL OR fv.id IS NOT NULL THEN 'voucher_created'
              ELSE nbsf.status::text
            END,
            'submitted'
          )
        ) AS status,
        (COALESCE(nbsf.voucher_created, FALSE) OR nbsf.voucher_id IS NOT NULL OR fv.id IS NOT NULL) AS voucher_created,
        nbsf.voucher_id::text AS scholarship_form_voucher_id,
        fv.id::text AS voucher_id,
        fv.voucher_no,
        LOWER(COALESCE(fv.status::text, '')) AS voucher_status,
        fv.amount::float8 AS voucher_amount,
        fv.total_amount::float8 AS voucher_total_amount,
        fv.regular_fee_amount::float8 AS regular_fee_amount,
        fv.admission_fee_amount::float8 AS admission_fee_amount,
        fv.discount_amount::float8 AS discount_amount,
        fv.scholarship_amount::float8 AS voucher_scholarship_amount,
        fv.due_date,
        latest_submission.id::text AS fee_submission_id,
        (latest_submission.status IS NOT NULL) AS has_fee_submission,
        LOWER(COALESCE(latest_submission.status::text, '')) AS fee_submission_status,
        latest_submission.paid_amount::float8 AS paid_amount,
        EXISTS (
          SELECT 1
          FROM enrollments e
          WHERE e.registration_id = nbsf.registration_id
             OR (fv.student_id IS NOT NULL AND e.student_id = fv.student_id)
          LIMIT 1
        ) AS is_lms_enrolled,
        COALESCE(nbsf.scholarship_amount::float8, 0) AS scholarship_amount,
        nbsf.created_at,
        nbsf.updated_at,
        rl.student_name,
        COALESCE(
          NULLIF(TRIM(pu.full_name), ''),
          NULLIF(TRIM(pu_by_email.full_name), ''),
          NULLIF(TRIM(rl.parent_name), ''),
          ''
        ) AS parent_name,
        rl.class_level,
        COALESCE(
          NULLIF(TRIM(pu.email), ''),
          NULLIF(TRIM(pu_by_email.email), ''),
          NULLIF(TRIM(rl.email), ''),
          ''
        ) AS email,
        COALESCE(
          NULLIF(TRIM(pu.phone), ''),
          NULLIF(TRIM(pu_by_email.phone), ''),
          NULLIF(TRIM(rl.phone), ''),
          ''
        ) AS phone,
        LOWER(COALESCE(rl.status::text, 'new_lead')) AS lead_status
      FROM need_based_scholarship_forms nbsf
      INNER JOIN registration_leads rl ON rl.id = nbsf.registration_id
      LEFT JOIN LATERAL (
        SELECT fv_inner.*
        FROM fee_vouchers fv_inner
        WHERE fv_inner.id = nbsf.voucher_id
           OR (
             nbsf.voucher_id IS NULL
             AND fv_inner.registration_id = nbsf.registration_id
             AND COALESCE(fv_inner.scholarship_amount, 0) > 0
           )
        ORDER BY
          CASE WHEN fv_inner.id = nbsf.voucher_id THEN 0 ELSE 1 END,
          CASE WHEN LOWER(fv_inner.status::text) = 'verified' THEN 0 ELSE 1 END,
          fv_inner.updated_at DESC NULLS LAST,
          fv_inner.created_at DESC NULLS LAST,
          fv_inner.id DESC
        LIMIT 1
      ) fv ON TRUE
      LEFT JOIN LATERAL (
        SELECT e.student_id
        FROM enrollments e
        WHERE e.registration_id = nbsf.registration_id
           OR (fv.student_id IS NOT NULL AND e.student_id = fv.student_id)
        ORDER BY e.updated_at DESC NULLS LAST, e.created_at DESC NULLS LAST, e.id DESC
        LIMIT 1
      ) active_enr ON TRUE
      LEFT JOIN student_profiles sp ON sp.id = COALESCE(fv.student_id, active_enr.student_id)
      LEFT JOIN LATERAL (
        SELECT spp.parent_id
        FROM student_parents spp
        WHERE spp.student_id = sp.id
        ORDER BY spp.is_primary DESC, spp.id DESC
        LIMIT 1
      ) primary_parent ON TRUE
      LEFT JOIN parent_profiles pp ON pp.id = primary_parent.parent_id
      LEFT JOIN users pu ON pu.id = pp.user_id
      LEFT JOIN LATERAL (
        SELECT u_parent.full_name, u_parent.email, u_parent.phone
        FROM users u_parent
        INNER JOIN parent_profiles pp_email ON pp_email.user_id = u_parent.id
        WHERE LOWER(u_parent.email) = LOWER(rl.email)
          AND NULLIF(TRIM(rl.email), '') IS NOT NULL
        ORDER BY u_parent.id DESC
        LIMIT 1
      ) pu_by_email ON TRUE
      LEFT JOIN LATERAL (
        SELECT fs.id, fs.status, fs.paid_amount
        FROM fee_submissions fs
        WHERE fs.voucher_id = fv.id
        ORDER BY fs.created_at DESC NULLS LAST, fs.id DESC
        LIMIT 1
      ) latest_submission ON TRUE
      ORDER BY nbsf.created_at DESC NULLS LAST, nbsf.id DESC
    `;

    return json("Scholarship records fetched.", 200, { items });
  } catch (error) {
    return json(error instanceof Error ? error.message : "Unable to fetch scholarship records.", 500);
  }
}
