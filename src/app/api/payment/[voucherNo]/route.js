import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

const ALLOWED_PUBLIC_STATUSES = new Set(["unpaid", "rejected"]);

function json(message, status = 200, extra = {}) {
  return NextResponse.json({ message, ...extra }, { status });
}

export async function GET(_request, { params }) {
  try {
    const { voucherNo } = await params;
    const [item] = await prisma.$queryRaw`
      SELECT
        fv.id::text AS id,
        fv.voucher_no,
        fv.amount,
        fv.due_date,
        LOWER(fv.status::text) AS status,
        fv.payment_method,
        fv.payment_instructions,
        rl.student_name,
        rl.parent_name,
        rl.email,
        rl.phone
      FROM fee_vouchers fv
      INNER JOIN registration_leads rl ON rl.id = fv.registration_id
      WHERE fv.voucher_no = ${voucherNo}
      LIMIT 1
    `;

    if (!item?.id) {
      return json("Voucher not found.", 404);
    }

    return json("Voucher fetched.", 200, {
      item: {
        ...item,
        canSubmit: ALLOWED_PUBLIC_STATUSES.has(String(item.status || "").toLowerCase()),
      },
    });
  } catch (error) {
    return json(
      error instanceof Error ? error.message : "Unable to fetch voucher.",
      500
    );
  }
}
