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

async function getLatestMonthlyVoucherBlockForStudent(studentId) {
  const [row] = await prisma.$queryRaw`
    SELECT
      fv.voucher_no,
      item.due_date,
      COALESCE(latest_fs.status::text, fv.status::text, 'unpaid') AS status
    FROM regular_monthly_fee_voucher_items item
    INNER JOIN fee_vouchers fv ON fv.id = item.voucher_id
    LEFT JOIN LATERAL (
      SELECT fs.status, fs.created_at, fs.id
      FROM fee_submissions fs
      WHERE fs.voucher_id = fv.id
      ORDER BY fs.created_at DESC NULLS LAST, fs.id DESC
      LIMIT 1
    ) latest_fs ON true
    WHERE (
      item.student_id = ${studentId}::uuid
      OR fv.registration_lead_id IN (
        SELECT e.registration_id
        FROM enrollments e
        WHERE e.student_id = ${studentId}::uuid
          AND e.registration_id IS NOT NULL
      )
    )
    ORDER BY fv.created_at DESC NULLS LAST, item.created_at DESC, fv.voucher_no DESC NULLS LAST
    LIMIT 1
  `;

  if (!row?.voucher_no) return null;

  const status = String(row.status || "").toLowerCase();
  const dueDate = row.due_date ? new Date(row.due_date) : null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const isOverdue = dueDate instanceof Date && !Number.isNaN(dueDate.getTime()) && dueDate.getTime() <= today.getTime();

  return ["unpaid", "rejected", "submitted"].includes(status) && isOverdue ? row : null;
}

async function getLatestMonthlyVoucherBlockForParent(userId) {
  const [row] = await prisma.$queryRaw`
    SELECT
      fv.voucher_no,
      item.due_date,
      COALESCE(latest_fs.status::text, fv.status::text, 'unpaid') AS status
    FROM regular_monthly_fee_voucher_items item
    INNER JOIN fee_vouchers fv ON fv.id = item.voucher_id
    LEFT JOIN LATERAL (
      SELECT fs.status, fs.created_at, fs.id
      FROM fee_submissions fs
      WHERE fs.voucher_id = fv.id
      ORDER BY fs.created_at DESC NULLS LAST, fs.id DESC
      LIMIT 1
    ) latest_fs ON true
    INNER JOIN student_parents spp ON spp.student_id = item.student_id
    INNER JOIN parent_profiles pp ON pp.id = spp.parent_id
    INNER JOIN users u ON u.id = pp.user_id
    WHERE u.id = ${userId}::uuid
    ORDER BY fv.created_at DESC NULLS LAST, item.created_at DESC, fv.voucher_no DESC NULLS LAST
    LIMIT 1
  `;

  if (!row?.voucher_no) return null;

  const status = String(row.status || "").toLowerCase();
  const dueDate = row.due_date ? new Date(row.due_date) : null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const isOverdue = dueDate instanceof Date && !Number.isNaN(dueDate.getTime()) && dueDate.getTime() <= today.getTime();

  return ["unpaid", "rejected", "submitted"].includes(status) && isOverdue ? row : null;
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
      const [studentProfile] = await prisma.$queryRaw`
        SELECT sp.id::text AS id
        FROM student_profiles sp
        WHERE sp.user_id = ${session.user.id}::uuid
        LIMIT 1
      `;

      if (studentProfile?.id) {
        const monthlyRow = await getLatestMonthlyVoucherBlockForStudent(studentProfile.id);
        if (monthlyRow?.voucher_no) {
          return json({
            blocked: true,
            role,
            voucher_no: monthlyRow.voucher_no,
            due_date: monthlyRow.due_date || null,
            message: "Your monthly fee due date has passed. Please submit payment or contact administration.",
          });
        }
      }

      const [row] = await prisma.$queryRaw`
        SELECT
          fv.voucher_no,
          fv.due_date
        FROM fee_vouchers fv
        INNER JOIN student_profiles sp ON sp.id = fv.student_id
        WHERE sp.user_id = ${session.user.id}::uuid
          AND NOT EXISTS (
            SELECT 1
            FROM regular_monthly_fee_voucher_items item
            WHERE item.voucher_id = fv.id
          )
          AND LOWER(fv.status::text) IN ('unpaid', 'rejected', 'submitted')
          AND fv.due_date <= timezone('Asia/Karachi', now())::date
        ORDER BY fv.created_at DESC NULLS LAST, fv.voucher_no DESC NULLS LAST
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

      const monthlyRow = await getLatestMonthlyVoucherBlockForParent(session.user.id);
      if (monthlyRow?.voucher_no) {
        return json({
          blocked: true,
          role,
          voucher_no: monthlyRow.voucher_no,
          due_date: monthlyRow.due_date || null,
          message: "Your child's monthly fee due date has passed. Please submit payment or contact administration.",
        });
      }

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
              AND NOT EXISTS (
                SELECT 1
                FROM regular_monthly_fee_voucher_items item
                WHERE item.voucher_id = fv.id
              )
              AND LOWER(fv.status::text) IN ('unpaid', 'rejected', 'submitted')
              AND fv.due_date <= timezone('Asia/Karachi', now())::date
            ORDER BY fv.created_at DESC NULLS LAST, fv.voucher_no DESC NULLS LAST
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
              AND NOT EXISTS (
                SELECT 1
                FROM regular_monthly_fee_voucher_items item
                WHERE item.voucher_id = fv.id
              )
              AND LOWER(fv.status::text) IN ('unpaid', 'rejected', 'submitted')
              AND fv.due_date <= timezone('Asia/Karachi', now())::date
            ORDER BY fv.created_at DESC NULLS LAST, fv.voucher_no DESC NULLS LAST
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
