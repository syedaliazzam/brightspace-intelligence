import { NextResponse } from "next/server";
import { requireRole, roleGuardResponse } from "@/lib/roleGuard";
import prisma from "@/lib/prisma";

const ALLOWED_ROLES = ["teacher", "admin"];

function json(message, status = 200, extra = {}) {
  return NextResponse.json({ message, ...extra }, { status });
}

export async function GET() {
  try {
    const session = await requireRole(ALLOWED_ROLES);
    const isAdmin = String(session.user.role).toLowerCase() === "admin";
    const where = isAdmin ? "" : "WHERE tp.user_id = $1::uuid";
    const values = isAdmin ? [] : [session.user.id];
    const items = await prisma.$queryRawUnsafe(
      `
      SELECT DISTINCT
        sp.id::text AS id,
        su.full_name,
        su.email,
        sp.age,
        sp.grade_level,
        sp.status::text AS status,
        sub.name AS subject_name,
        c.title AS course_title
      FROM student_profiles sp
      INNER JOIN users su ON su.id = sp.user_id
      LEFT JOIN teacher_assignments ta ON ta.student_id = sp.id
      LEFT JOIN lecture_schedules ls ON ls.student_id = sp.id
      LEFT JOIN teacher_profiles tp ON tp.id = COALESCE(ta.teacher_id, ls.teacher_id)
      LEFT JOIN subjects sub ON sub.id = COALESCE(ta.subject_id, ls.subject_id)
      LEFT JOIN courses c ON c.id = ta.course_id
      ${where}
      ORDER BY su.full_name ASC
      `,
      ...values
    );
    return json("Students fetched.", 200, { items });
  } catch (error) {
    const guard = roleGuardResponse(error);
    return guard || json(error instanceof Error ? error.message : "Unable to load students.", 500);
  }
}
