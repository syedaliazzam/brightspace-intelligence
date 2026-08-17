import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";

const ALLOWED_ROLES = new Set(["admin", "coordinator"]);

function json(message, status = 200, extra = {}) {
  return NextResponse.json({ message, ...extra }, { status });
}

export async function GET(_request, { params }) {
  const session = await auth();
  const role = String(session?.user?.role || "").toLowerCase();

  if (!session?.user) {
    return json("Unauthorized.", 401);
  }

  if (!ALLOWED_ROLES.has(role)) {
    return json("Forbidden.", 403);
  }

  try {
    const { id } = await params;
    const [item] = await prisma.$queryRaw`
      SELECT
        fv.id::text AS id,
        fv.voucher_no,
        fv.amount::text AS amount,
        fv.due_date,
        fv.payment_method,
        fv.payment_instructions,
        LOWER(fv.status::text) AS status,
        fv.regular_fee_applied,
        fv.regular_fee_amount::text AS regular_fee_amount,
        fv.admission_fee_amount::text AS admission_fee_amount,
        fv.subtotal_amount::text AS subtotal_amount,
        fv.discount_percent::text AS discount_percent,
        fv.discount_amount::text AS discount_amount,
        fv.total_amount::text AS total_amount,
        COALESCE(latest_history.remaining_due::float8, COALESCE(fv.total_amount::float8, fv.amount::float8, 0)) AS current_pending_due,
        fv.payment_method_id::text AS payment_method_id,
        fv.regular_fee_id::text AS regular_fee_id,
        fs.id::text AS fee_submission_id,
        LOWER(COALESCE(fs.status::text, '')) AS payment_submission_status,
        fs.paid_amount::float8 AS paid_amount,
        fs.paid_at,
        fs.proof_file_path,
        rl.id::text AS registration_lead_id,
        rl.student_name,
        rl.parent_name,
        rl.email,
        rl.phone,
        rl.class_level,
        pm.name AS payment_method_name,
        pm.bank_name,
        pm.account_title,
        pm.account_number,
        pm.iban,
        pm.branch_code,
        pm.instructions AS payment_method_instructions
      FROM fee_vouchers fv
      LEFT JOIN registration_leads rl ON rl.id = COALESCE(fv.registration_id, fv.registration_lead_id)
      LEFT JOIN payment_methods pm ON pm.id = fv.payment_method_id
      LEFT JOIN LATERAL (
        SELECT
          fs.id,
          fs.status,
          fs.paid_amount,
          fs.paid_at,
          fs.proof_file_path
        FROM fee_submissions fs
        WHERE fs.voucher_id = fv.id
        ORDER BY fs.created_at DESC NULLS LAST, fs.id DESC
        LIMIT 1
      ) fs ON TRUE
      LEFT JOIN LATERAL (
        SELECT fhr.remaining_due
        FROM fee_history_records fhr
        WHERE fhr.voucher_id = fv.id
        ORDER BY fhr.due_date DESC NULLS LAST, fhr.created_at DESC NULLS LAST, fhr.id DESC
        LIMIT 1
      ) latest_history ON TRUE
      WHERE fv.id = ${id}::uuid
      LIMIT 1
    `;

    if (!item?.id) {
      return json("Fee voucher not found.", 404);
    }

    return json("Fee voucher fetched.", 200, {
      item: {
        ...item,
        fee_submission_id: item.fee_submission_id || "",
        payment_submission_status: item.payment_submission_status || "",
        paid_amount: item.paid_amount || "",
        paid_at: item.paid_at || "",
        proof_file_path: item.proof_file_path || "",
        payment_method_details: {
          name: item.payment_method_name || item.payment_method || "",
          bank_name: item.bank_name || "",
          account_title: item.account_title || "",
          account_number: item.account_number || "",
          iban: item.iban || "",
          branch_code: item.branch_code || "",
          instructions: item.payment_method_instructions || "",
        },
      },
    });
  } catch (error) {
    return json(
      error instanceof Error ? error.message : "Unable to fetch fee voucher.",
      500
    );
  }
}
