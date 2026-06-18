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
    
    // FIXED: Explicitly added fv.status::text casting and id::uuid casting
    const [item] = await prisma.$queryRaw`
      SELECT
        fv.id::text AS id,
        fv.voucher_no,
        fv.amount,
        fv.due_date,
        fv.payment_method,
        fv.payment_instructions,
        LOWER(fv.status::text) AS status,
        rl.id::text AS registration_lead_id,
        rl.student_name,
        rl.parent_name,
        rl.email,
        rl.phone,
        rl.class_level,
        rl.subject_interest
      FROM fee_vouchers fv
      INNER JOIN registration_leads rl ON rl.id = fv.registration_id
      WHERE fv.id = ${id}::uuid
      LIMIT 1
    `;

    if (!item?.id) {
      return json("Fee voucher not found.", 404);
    }

    return json("Fee voucher fetched.", 200, { item });
  } catch (error) {
    return json(
      error instanceof Error ? error.message : "Unable to fetch fee voucher.",
      500
    );
  }
}