import { NextResponse } from "next/server";
import { requireRole, roleGuardResponse } from "@/lib/roleGuard";
import prisma from "@/lib/prisma";

function json(message, status = 200, extra = {}) {
  return NextResponse.json({ message, ...extra }, { status });
}

export async function GET() {
  try {
    const session = await requireRole(["student"]);
    const [profile] = await prisma.$queryRaw`
      SELECT
        u.full_name,
        u.email,
        u.phone,
        u.status::text AS user_status,
        sp.id::text AS student_id,
        sp.admission_no,
        sp.age,
        sp.grade_level,
        sp.status::text AS profile_status,
        c.title AS course_title,
        pu.full_name AS father_name,
        pu.phone AS father_phone
      FROM student_profiles sp
      INNER JOIN users u ON u.id = sp.user_id
      LEFT JOIN enrollments e ON e.student_id = sp.id AND e.status = 'active'
      LEFT JOIN courses c ON c.id = e.course_id
      LEFT JOIN student_parents spp ON spp.student_id = sp.id AND spp.is_primary = TRUE
      LEFT JOIN parent_profiles pp ON pp.id = spp.parent_id
      LEFT JOIN users pu ON pu.id = pp.user_id
      WHERE sp.user_id = ${session.user.id}::uuid
      LIMIT 1
    `;
    return json("Profile fetched.", 200, { profile });
  } catch (error) {
    const guard = roleGuardResponse(error);
    return guard || json(error instanceof Error ? error.message : "Unable to load profile.", 500);
  }
}
