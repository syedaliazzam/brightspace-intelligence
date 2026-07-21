import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { createSignedAdmissionDocumentUrl } from "@/lib/supabaseStorage";

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
        nbsf.id::text AS id,
        nbsf.registration_id::text AS registration_id,
        nbsf.interested_student_id::text AS interested_student_id,
        nbsf.lead_token,
        nbsf.monthly_income::float8 AS monthly_income,
        nbsf.dependents_count,
        nbsf.school_going_children_count,
        nbsf.residence_type,
        nbsf.guardian_employment_status,
        nbsf.requested_amount::float8 AS requested_amount,
        nbsf.reason,
        nbsf.supporting_document_file_path,
        LOWER(COALESCE(nbsf.status::text, 'submitted')) AS status,
        COALESCE(nbsf.voucher_created, FALSE) AS voucher_created,
        nbsf.voucher_id::text AS voucher_id,
        COALESCE(nbsf.scholarship_amount::float8, 0) AS scholarship_amount,
        nbsf.created_at,
        nbsf.updated_at,
        rl.student_name,
        rl.parent_name,
        rl.class_level,
        rl.email,
        rl.phone,
        LOWER(COALESCE(rl.status::text, 'new_lead')) AS lead_status
      FROM need_based_scholarship_forms nbsf
      INNER JOIN registration_leads rl ON rl.id = nbsf.registration_id
      ORDER BY nbsf.created_at DESC NULLS LAST, nbsf.id DESC
    `;

    const itemsWithPreview = await Promise.all(
      items.map(async (item) => ({
        ...item,
        supporting_document_preview_url: item.supporting_document_file_path
          ? await createSignedAdmissionDocumentUrl(item.supporting_document_file_path).catch(() => "")
          : "",
      }))
    );

    return json("Need-based scholarship records fetched.", 200, { items: itemsWithPreview });
  } catch (error) {
    return json(error instanceof Error ? error.message : "Unable to fetch scholarship records.", 500);
  }
}
