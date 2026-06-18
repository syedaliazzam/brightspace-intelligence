import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireRole, roleGuardResponse } from "@/lib/roleGuard";

const ALLOWED_ROLES = ["admin", "coordinator"];

function json(message, status = 200, extra = {}) {
  return NextResponse.json({ message, ...extra }, { status });
}

function normalizeText(value) {
  return typeof value === "string" ? value.trim() : "";
}

export async function GET(request) {
  try {
    await requireRole(ALLOWED_ROLES);

    const { searchParams } = new URL(request.url);
    const search = normalizeText(searchParams.get("search"));
    const status = normalizeText(searchParams.get("status")).toLowerCase();
    const conditions = [];

    if (search) {
      const term = `%${search}%`;
      conditions.push(
        Prisma.sql`(
          u.full_name ILIKE ${term}
          OR u.email ILIKE ${term}
          OR u.phone ILIKE ${term}
          OR sp.admission_no ILIKE ${term}
          OR sp.grade_level ILIKE ${term}
        )`
      );
    }

    if (status) {
      conditions.push(Prisma.sql`LOWER(COALESCE(sp.status::text, u.status::text)) = ${status}`);
    }

    const whereClause = conditions.length
      ? Prisma.sql`WHERE ${Prisma.join(conditions, Prisma.sql` AND `)}`
      : Prisma.empty;

    const items = await prisma.$queryRaw`
      SELECT
        sp.id::text AS id,
        u.id::text AS user_id,
        u.full_name,
        u.email,
        u.phone,
        sp.admission_no,
        sp.age,
        sp.grade_level,
        COALESCE(sp.status::text, u.status::text) AS status,
        c.title AS course_title,
        p.full_name AS parent_name,
        pu.phone AS parent_phone,
        pu.email AS parent_email
      FROM student_profiles sp
      INNER JOIN users u ON u.id = sp.user_id
      LEFT JOIN enrollments e ON e.student_id = sp.id AND LOWER(e.status) = 'active'
      LEFT JOIN courses c ON c.id = e.course_id
      LEFT JOIN student_parents spp ON spp.student_id = sp.id AND spp.is_primary = TRUE
      LEFT JOIN parent_profiles pp ON pp.id = spp.parent_id
      LEFT JOIN users p ON p.id = pp.user_id
      LEFT JOIN users pu ON pu.id = pp.user_id
      ${whereClause}
      ORDER BY u.full_name ASC
    `;

    return json("Students fetched.", 200, { items });
  } catch (error) {
    const guard = roleGuardResponse(error);
    if (guard) {
      return guard;
    }

    return json(error instanceof Error ? error.message : "Unable to fetch students.", 500);
  }
}

