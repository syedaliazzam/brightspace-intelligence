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
    const conditions = [];

    if (search) {
      const term = `%${search}%`;
      conditions.push(
        Prisma.sql`(
          u.full_name ILIKE ${term}
          OR u.email ILIKE ${term}
          OR u.phone ILIKE ${term}
          OR pp.relation ILIKE ${term}
        )`
      );
    }

    const whereClause = conditions.length
      ? Prisma.sql`WHERE ${Prisma.join(conditions, Prisma.sql` AND `)}`
      : Prisma.empty;

    const items = await prisma.$queryRaw`
      SELECT
        pp.id::text AS id,
        u.id::text AS user_id,
        u.full_name,
        u.email,
        u.phone,
        pp.relation,
        STRING_AGG(su.full_name, ', ' ORDER BY su.full_name) AS student_names
      FROM parent_profiles pp
      INNER JOIN users u ON u.id = pp.user_id
      LEFT JOIN student_parents spp ON spp.parent_id = pp.id
      LEFT JOIN student_profiles sp ON sp.id = spp.student_id
      LEFT JOIN users su ON su.id = sp.user_id
      ${whereClause}
      GROUP BY pp.id, u.id, u.full_name, u.email, u.phone, pp.relation
      ORDER BY u.full_name ASC
    `;

    return json("Parents fetched.", 200, { items });
  } catch (error) {
    const guard = roleGuardResponse(error);
    if (guard) {
      return guard;
    }

    return json(error instanceof Error ? error.message : "Unable to fetch parents.", 500);
  }
}

