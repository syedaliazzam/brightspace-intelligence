import { NextResponse } from "next/server";
import { requireRole, roleGuardResponse } from "@/lib/roleGuard";
import prisma from "@/lib/prisma";

const ALLOWED_ROLES = ["parent", "admin"];

function json(message, status = 200, extra = {}) {
  return NextResponse.json({ message, ...extra }, { status });
}

async function getChildren(session) {
  const role = String(session?.user?.role || "").toLowerCase();

  if (role === "admin") {
    return prisma.$queryRaw`
      SELECT
        sp.id::text AS id,
        sp.user_id::text AS user_id,
        u.full_name,
        u.username,
        u.email,
        u.phone,
        sp.age,
        sp.grade_level,
        sp.status::text AS status
      FROM student_profiles sp
      INNER JOIN users u ON u.id = sp.user_id
      ORDER BY u.full_name ASC
    `;
  }

  return prisma.$queryRaw`
    SELECT
      sp.id::text AS id,
      sp.user_id::text AS user_id,
      u.full_name,
      u.username,
      u.email,
      u.phone,
      sp.age,
      sp.grade_level,
      sp.status::text AS status
    FROM parent_profiles pp
    INNER JOIN student_parents spp ON spp.parent_id = pp.id
    INNER JOIN student_profiles sp ON sp.id = spp.student_id
    INNER JOIN users u ON u.id = sp.user_id
    WHERE pp.user_id = ${session.user.id}::uuid
    ORDER BY spp.is_primary DESC, u.full_name ASC
  `;
}

export async function GET() {
  try {
    const session = await requireRole(ALLOWED_ROLES);
    const children = await getChildren(session);
    return json("Children fetched.", 200, { children });
  } catch (error) {
    const guard = roleGuardResponse(error);
    return guard || json(error instanceof Error ? error.message : "Unable to load children.", 500);
  }
}
