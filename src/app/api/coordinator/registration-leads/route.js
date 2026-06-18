import { Prisma } from "@prisma/client";
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

  if (status && VALID_STATUSES.has(status)) {
    conditions.push(Prisma.sql`status = ${status}`);
  }

  if (search) {
    const term = `%${search}%`;
    conditions.push(
      Prisma.sql`(
        student_name ILIKE ${term}
        OR parent_name ILIKE ${term}
        OR email ILIKE ${term}
        OR phone ILIKE ${term}
      )`
    );
  }

  const whereClause = conditions.length
    ? Prisma.sql`WHERE ${Prisma.join(conditions, Prisma.sql` AND `)}`
    : Prisma.empty;

  try {
    const leads = await prisma.$queryRaw`
      SELECT
        id::text AS id,
        google_sheet_row_id,
        submitted_at,
        student_name,
        parent_name,
        parent_relation,
        email,
        phone,
        student_age,
        class_level,
        subject_interest,
        preferred_schedule,
        address,
        city,
        notes,
        source,
        status
      FROM registration_leads
      ${whereClause}
      ORDER BY submitted_at DESC NULLS LAST, id DESC
    `;

    return json("Registration leads fetched.", 200, { items: leads });
  } catch (error) {
    return json(
      error instanceof Error ? error.message : "Unable to fetch registration leads.",
      500
    );
  }
}
