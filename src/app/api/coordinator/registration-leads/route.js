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
    conditions.push(`LOWER(rl.status::text) = $${values.length}`);
  }

  if (search) {
    const term = `%${search}%`;
    values.push(term);
    conditions.push(`(
        rl.student_name ILIKE $${values.length}
        OR rl.parent_name ILIKE $${values.length}
        OR rl.email ILIKE $${values.length}
        OR rl.phone ILIKE $${values.length}
      )`);
  }

  const whereClause = conditions.length
    ? `WHERE ${conditions.join(" AND ")}`
    : "";

  try {
    const leads = await prisma.$queryRawUnsafe(
      `
    SELECT
      rl.id::text AS id,
      rl.student_name,
      rl.parent_name,
      rl.class_level,
      rl.parent_relation,
      rl.preferred_schedule,
      rl.created_at AS submitted_at,
      rl.email,
      rl.phone,
      LOWER(rl.status::text) AS status,
      fv.id::text AS voucher_id,
      LOWER(fv.status::text) AS voucher_status,
      CASE
        WHEN rl.status::text = 'new_lead' AND fv.id IS NULL THEN true
        ELSE false
      END AS can_create_voucher
    FROM registration_leads rl
    LEFT JOIN fee_vouchers fv ON fv.registration_id = rl.id
    ${whereClause}
    ORDER BY rl.created_at DESC NULLS LAST, rl.id DESC
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
