import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";

const ALLOWED_ROLES = new Set(["admin", "coordinator"]);
const VALID_STATUSES = new Set([
  "new_lead",
  "voucher_created",
  "fee_submitted",
  "fee_verified",
  "access_granted",
  "rejected",
  "pending_clarification",
]);

function json(message, status = 200, extra = {}) {
  return NextResponse.json({ message, ...extra }, { status });
}

function normalizeSearch(value) {
  return typeof value === "string" ? value.trim() : "";
}

export async function GET(request) {
  const session = await auth();
  const role = String(session?.user?.role || "").toLowerCase();

  if (!session?.user) {
    return json("Unauthorized.", 401);
  }

  if (!ALLOWED_ROLES.has(role)) {
    return json("Forbidden.", 403);
  }

  const { searchParams } = new URL(request.url);
  const status = normalizeSearch(searchParams.get("status")).toLowerCase();
  const search = normalizeSearch(searchParams.get("search"));
  const conditions = [];
  const values = [];

  if (status && VALID_STATUSES.has(status)) {
    values.push(status);
    conditions.push(`effective_status = $${values.length}`);
  }

  if (search) {
    const term = `%${search}%`;
    values.push(term);
    conditions.push(`(
        student_name ILIKE $${values.length}
        OR parent_name ILIKE $${values.length}
        OR email ILIKE $${values.length}
        OR phone ILIKE $${values.length}
      )`);
  }

  const whereClause = conditions.length
    ? `WHERE ${conditions.join(" AND ")}`
    : "";

  try {
    const leads = await prisma.$queryRawUnsafe(
      `
      WITH lead_rows AS (
        SELECT
          rl.*,
          EXISTS (
            SELECT 1
            FROM fee_vouchers fv
            WHERE fv.registration_id = rl.id
          ) AS has_voucher,
          CASE
            WHEN rl.status::text = 'voucher_created'
              AND NOT EXISTS (
                SELECT 1
                FROM fee_vouchers fv
                WHERE fv.registration_id = rl.id
              )
            THEN 'new_lead'
            ELSE LOWER(rl.status::text)
          END AS effective_status
        FROM registration_leads rl
      )
      SELECT
        id::text AS id,
        google_sheet_row_id,
        created_at AS submitted_at,
        student_name,
        parent_name,
        NULL::text AS parent_relation,
        email,
        phone,
        age AS student_age,
        class_level,
        subject_interest,
        preferred_schedule,
        address,
        NULL::text AS city,
        notes,
        source,
        has_voucher,
        effective_status AS status
      FROM lead_rows
      ${whereClause}
      ORDER BY updated_at DESC NULLS LAST, created_at DESC NULLS LAST, id DESC
      `,
      ...values
    );

    return json("Registration leads fetched.", 200, { items: leads });
  } catch (error) {
    return json(
      error instanceof Error ? error.message : "Unable to fetch registration leads.",
      500
    );
  }
}
