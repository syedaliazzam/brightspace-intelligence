import { NextResponse } from "next/server";
import { requireRole, roleGuardResponse } from "@/lib/roleGuard";
import prisma from "@/lib/prisma";
import { getActiveHeadlines } from "@/lib/headlines";

const ALLOWED_ROLES = ["parent", "admin"];

function json(message, status = 200, extra = {}) {
  return NextResponse.json({ message, ...extra }, { status });
}

function normalizeText(value) {
  return typeof value === "string" ? value.trim() : "";
}

function childScopeSql(session, childId) {
  const role = String(session?.user?.role || "").toLowerCase();

  if (role === "admin") {
    return childId
      ? { where: `WHERE sp.id = $1::uuid`, values: [childId] }
      : { where: "", values: [] };
  }

  return childId
    ? { where: `WHERE pp.user_id = $1::uuid AND sp.id = $2::uuid`, values: [session.user.id, childId] }
    : { where: `WHERE pp.user_id = $1::uuid`, values: [session.user.id] };
}

async function getChildren(session) {
  const role = String(session?.user?.role || "").toLowerCase();
  if (role === "admin") {
    return prisma.$queryRaw`
      SELECT sp.id::text AS id, u.full_name, sp.grade_level
      FROM student_profiles sp
      INNER JOIN users u ON u.id = sp.user_id
      ORDER BY u.full_name ASC
    `;
  }

  return prisma.$queryRaw`
    SELECT sp.id::text AS id, u.full_name, sp.grade_level
    FROM parent_profiles pp
    INNER JOIN student_parents spp ON spp.parent_id = pp.id
    INNER JOIN student_profiles sp ON sp.id = spp.student_id
    INNER JOIN users u ON u.id = sp.user_id
    WHERE pp.user_id = ${session.user.id}::uuid
    ORDER BY spp.is_primary DESC, u.full_name ASC
  `;
}

export async function GET(request) {
  try {
    const session = await requireRole(ALLOWED_ROLES);
    const { searchParams } = new URL(request.url);
    const childId = normalizeText(searchParams.get("childId"));
    const children = await getChildren(session);
    const selectedChildId = childId || children[0]?.id || "";
    const scope = childScopeSql(session, selectedChildId);

    const [stats, headlines] = await Promise.all([
      prisma.$queryRawUnsafe(
      `
      WITH allowed_students AS (
        SELECT sp.id, u.full_name
        FROM student_profiles sp
        INNER JOIN users u ON u.id = sp.user_id
        ${String(session.user.role).toLowerCase() === "admin" ? "" : "INNER JOIN student_parents spp ON spp.student_id = sp.id INNER JOIN parent_profiles pp ON pp.id = spp.parent_id"}
        ${scope.where}
      )
      SELECT
        (SELECT COUNT(DISTINCT ls.id)::int
         FROM lecture_schedules ls
         INNER JOIN enrollments e ON e.id = ls.enrollment_id
         INNER JOIN course_subjects cs ON cs.course_id = e.course_id AND cs.subject_id = ls.subject_id
         INNER JOIN allowed_students a ON (
           a.id = e.student_id
           OR e.course_id IN (
             SELECT course_id FROM enrollments
             WHERE student_id = a.id
               AND LOWER(status) = 'active'
           )
         )
         WHERE ls.scheduled_start >= NOW()
           AND ls.status::text NOT IN ('cancelled','rescheduled')) AS upcoming_classes,
        (SELECT COUNT(DISTINCT ls.id)::int
         FROM lecture_schedules ls
         INNER JOIN enrollments e ON e.id = ls.enrollment_id
         INNER JOIN course_subjects cs ON cs.course_id = e.course_id AND cs.subject_id = ls.subject_id
         INNER JOIN allowed_students a ON (
           a.id = e.student_id
           OR e.course_id IN (
             SELECT course_id FROM enrollments
             WHERE student_id = a.id
               AND LOWER(status) = 'active'
           )
         )
         WHERE ls.status::text = 'verified_by_coordinator') AS attended_lectures,
        (SELECT COUNT(*)::int
         FROM lecture_attendance la
         INNER JOIN student_profiles sp ON sp.user_id = la.user_id
         INNER JOIN allowed_students a ON a.id = sp.id
         WHERE LOWER(la.status::text) = 'present') AS present_lectures,
        (SELECT COUNT(*)::int FROM homework h INNER JOIN allowed_students a ON a.id = h.student_id WHERE COALESCE(h.status::text, 'pending') = 'pending') AS pending_homework,
        COALESCE((SELECT ROUND(100.0 * COUNT(*) FILTER (WHERE la.status::text = 'present') / NULLIF(COUNT(*), 0))::int FROM lecture_attendance la INNER JOIN student_profiles sp ON sp.user_id = la.user_id INNER JOIN allowed_students a ON a.id = sp.id INNER JOIN lecture_schedules ls ON ls.id = la.lecture_id AND ls.status::text = 'verified_by_coordinator'), 0) AS attendance_percentage,
        COALESCE((
          SELECT COALESCE(fs.status::text, fv.status::text, 'not_available')
          FROM allowed_students a
          LEFT JOIN registration_leads rl ON LOWER(rl.student_name) = LOWER(a.full_name)
          LEFT JOIN fee_vouchers fv ON fv.student_id = a.id OR (fv.student_id IS NULL AND fv.registration_id = rl.id)
          LEFT JOIN fee_submissions fs ON fs.voucher_id = fv.id
          ORDER BY fv.created_at DESC NULLS LAST, fs.created_at DESC NULLS LAST
          LIMIT 1
        ), 'not_available') AS fee_status
      `,
      ...scope.values
      ),
      getActiveHeadlines(),
    ]);

    const upcoming = await prisma.$queryRawUnsafe(
      `
      WITH allowed_students AS (
        SELECT sp.id, u.full_name
        FROM student_profiles sp
        INNER JOIN users u ON u.id = sp.user_id
        ${String(session.user.role).toLowerCase() === "admin" ? "" : "INNER JOIN student_parents spp ON spp.student_id = sp.id INNER JOIN parent_profiles pp ON pp.id = spp.parent_id"}
        ${scope.where}
      )
      SELECT DISTINCT ON (ls.id)
        ls.id::text AS id,
        ls.title,
        ls.scheduled_start::text AS scheduled_start,
        ls.scheduled_end::text AS scheduled_end,
        ls.google_meet_link,
        ls.status::text AS status,
        sub.name AS subject_name,
        tu.full_name AS teacher_name
      FROM lecture_schedules ls
      INNER JOIN enrollments e ON e.id = ls.enrollment_id
      INNER JOIN course_subjects cs ON cs.course_id = e.course_id AND cs.subject_id = ls.subject_id
      INNER JOIN subjects sub ON sub.id = ls.subject_id
      INNER JOIN teacher_profiles tp ON tp.id = ls.teacher_id
      INNER JOIN users tu ON tu.id = tp.user_id
      INNER JOIN allowed_students a ON (
        ls.student_id = a.id
        OR e.student_id = a.id
        OR e.course_id IN (
          SELECT course_id
          FROM enrollments
          WHERE student_id = a.id
            AND LOWER(status) = 'active'
        )
      )
      WHERE ls.scheduled_end >= NOW()
      ORDER BY ls.id ASC, ls.scheduled_start ASC
      LIMIT 5
      `,
      ...scope.values
    );

    return json("Parent dashboard fetched.", 200, {
      children,
      selectedChildId,
      headlines,
      stats: {
        ...(stats?.[0] || {}),
        total_children: children.length,
      },
      upcoming,
      nextClass: upcoming[0] || null,
    });
  } catch (error) {
    const guard = roleGuardResponse(error);
    return guard || json(error instanceof Error ? error.message : "Unable to load parent dashboard.", 500);
  }
}
