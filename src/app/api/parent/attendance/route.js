import { NextResponse } from "next/server";
import { requireRole, roleGuardResponse } from "@/lib/roleGuard";
import prisma from "@/lib/prisma";

const ALLOWED_ROLES = ["parent", "admin"];

function json(message, status = 200, extra = {}) {
  return NextResponse.json({ message, ...extra }, { status });
}

export async function GET(request) {
  try {
    const session = await requireRole(ALLOWED_ROLES);
    const { searchParams } = new URL(request.url);
    const childId = String(searchParams.get("childId") || "").trim();
    const isAdmin = String(session.user.role).toLowerCase() === "admin";

    if (!childId) {
      return json("Child is required.", 400, { items: [], summary: { total_conducted: 0, attended_classes: 0, absent_classes: 0, attendance_percentage: 0 } });
    }

    if (!isAdmin) {
      const [ownership] = await prisma.$queryRaw`
        SELECT sp.id::text AS id
        FROM student_profiles sp
        INNER JOIN student_parents spp ON spp.student_id = sp.id
        INNER JOIN parent_profiles pp ON pp.id = spp.parent_id
        WHERE pp.user_id = ${session.user.id}::uuid
          AND sp.id = ${childId}::uuid
        LIMIT 1
      `;
      if (!ownership?.id) {
        return json("Child not found.", 404, { items: [], summary: { total_conducted: 0, attended_classes: 0, absent_classes: 0, attendance_percentage: 0 } });
      }
    }

    const summaryRows = await prisma.$queryRawUnsafe(
      `
      SELECT
        COUNT(ls.id)::int AS total_conducted,
        COUNT(*) FILTER (WHERE COALESCE(la.status::text, 'absent') IN ('present', 'partial'))::int AS attended_classes,
        COUNT(*) FILTER (WHERE COALESCE(la.status::text, 'absent') = 'absent' OR la.id IS NULL)::int AS absent_classes,
        COALESCE(
          ROUND(
            (COUNT(*) FILTER (WHERE COALESCE(la.status::text, 'absent') IN ('present', 'partial'))::numeric
              / NULLIF(COUNT(ls.id), 0)) * 100
          ),
          0
        )::int AS attendance_percentage
      FROM student_profiles sp
      INNER JOIN lecture_schedules ls ON (
        ls.student_id = sp.id
        OR ls.enrollment_id IN (
          SELECT e2.id
          FROM enrollments e2
          WHERE e2.course_id IN (
            SELECT course_id
            FROM enrollments
            WHERE student_id = sp.id
              AND LOWER(status) = 'active'
          )
        )
      )
      LEFT JOIN lecture_attendance la ON la.lecture_id = ls.id AND la.user_id = sp.user_id
      WHERE sp.id = $1::uuid
        AND ls.status::text = 'verified_by_coordinator'
      `,
      childId
    );

    const rows = await prisma.$queryRawUnsafe(
      `
      SELECT
        ls.id::text AS id,
        COALESCE(la.status::text, 'absent') AS status,
        la.joined_at,
        la.left_at,
        la.duration_minutes,
        ls.title AS class_title,
        ls.scheduled_start,
        ls.scheduled_end,
        sub.name AS subject_name,
        su.full_name AS student_name
      FROM student_profiles sp
      INNER JOIN lecture_schedules ls ON (
        ls.student_id = sp.id
        OR ls.enrollment_id IN (
          SELECT e2.id
          FROM enrollments e2
          WHERE e2.course_id IN (
            SELECT course_id
            FROM enrollments
            WHERE student_id = sp.id
              AND LOWER(status) = 'active'
          )
        )
      )
      LEFT JOIN lecture_attendance la ON la.lecture_id = ls.id AND la.user_id = sp.user_id
      INNER JOIN subjects sub ON sub.id = ls.subject_id
      INNER JOIN users su ON su.id = sp.user_id
      WHERE sp.id = $1::uuid
        AND ls.status::text = 'verified_by_coordinator'
      ORDER BY ls.scheduled_start DESC
      `,
      childId
    );

    return json("Attendance fetched.", 200, {
      items: rows,
      summary: summaryRows?.[0] || { total_conducted: 0, attended_classes: 0, absent_classes: 0, attendance_percentage: 0 },
    });
  } catch (error) {
    const guard = roleGuardResponse(error);
    return guard || json(error instanceof Error ? error.message : "Unable to load attendance.", 500);
  }
}
