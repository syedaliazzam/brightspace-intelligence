import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";

function json(payload, status = 200) {
  return NextResponse.json(payload, { status });
}

function normalizeText(value) {
  return typeof value === "string" ? value.trim() : "";
}

function isValidPhone(value) {
  return normalizeText(value).replace(/\D/g, "").length >= 7;
}

export async function GET() {
  const session = await auth();
  const role = String(session?.user?.role || "").toLowerCase();

  if (!session?.user) {
    return json({ blocked: false });
  }

  if (!["parent", "student"].includes(role)) {
    return json({ blocked: false });
  }

  try {
    if (role === "student") {
      const [row] = await prisma.$queryRaw`
        SELECT
          fv.voucher_no,
          fv.due_date
        FROM fee_vouchers fv
        INNER JOIN student_profiles sp ON sp.id = fv.student_id
        WHERE sp.user_id = ${session.user.id}::uuid
          AND LOWER(fv.status::text) IN ('unpaid', 'rejected', 'submitted')
          AND fv.due_date < CURRENT_DATE
        ORDER BY fv.due_date ASC NULLS LAST, fv.created_at DESC
        LIMIT 1
      `;

      if (row?.voucher_no) {
        return json({
          blocked: true,
          role,
          voucher_no: row.voucher_no,
          due_date: row.due_date || null,
          message: "Payment submission due date has passed. Please contact administration.",
        });
      }
    }

    if (role === "parent") {
      const parentPhone = normalizeText(session.user.phone || "");

      const [row] = isValidPhone(parentPhone)
        ? await prisma.$queryRaw`
            SELECT
              fv.voucher_no,
              fv.due_date
            FROM fee_vouchers fv
            INNER JOIN student_profiles sp ON sp.id = fv.student_id
            INNER JOIN student_parents spl ON spl.student_id = sp.id
            INNER JOIN parent_profiles pp ON pp.id = spl.parent_id
            INNER JOIN users u ON u.id = pp.user_id
            WHERE u.id = ${session.user.id}::uuid
              AND LOWER(fv.status::text) IN ('unpaid', 'rejected', 'submitted')
              AND fv.due_date < CURRENT_DATE
            ORDER BY fv.due_date ASC NULLS LAST, fv.created_at DESC
            LIMIT 1
          `
        : await prisma.$queryRaw`
            SELECT
              fv.voucher_no,
              fv.due_date
            FROM fee_vouchers fv
            INNER JOIN student_profiles sp ON sp.id = fv.student_id
            INNER JOIN student_parents spl ON spl.student_id = sp.id
            INNER JOIN parent_profiles pp ON pp.id = spl.parent_id
            INNER JOIN users u ON u.id = pp.user_id
            WHERE u.id = ${session.user.id}::uuid
              AND LOWER(fv.status::text) IN ('unpaid', 'rejected', 'submitted')
              AND fv.due_date < CURRENT_DATE
            ORDER BY fv.due_date ASC NULLS LAST, fv.created_at DESC
            LIMIT 1
          `;

      if (row?.voucher_no) {
        return json({
          blocked: true,
          role,
          voucher_no: row.voucher_no,
          due_date: row.due_date || null,
          message: "Payment submission due date has passed. Please contact administration.",
        });
      }
    }

    return json({ blocked: false });
  } catch (error) {
    return json({ blocked: false, error: error instanceof Error ? error.message : "Unable to check payment access." }, 200);
  }
}
