import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireRole, roleGuardResponse } from "@/lib/roleGuard";

const ALLOWED_ROLES = ["admin", "coordinator"];

function json(message, status = 200, extra = {}) {
  return NextResponse.json({ message, ...extra }, { status });
}

export async function GET() {
  try {
    await requireRole(ALLOWED_ROLES);

    const [
      registrationPipeline,
      feeVerification,
      lectureCompletion,
      teacherClassReport,
      studentActivity,
      recentLeads,
      recentLectures,
    ] = await Promise.all([
      prisma.$queryRaw`
        SELECT status::text AS label, COUNT(*)::int AS total
        FROM registration_leads
        GROUP BY status
        ORDER BY status::text
      `,
      prisma.$queryRaw`
        SELECT status::text AS label, COUNT(*)::int AS total
        FROM fee_submissions
        GROUP BY status
        ORDER BY status::text
      `,
      prisma.$queryRaw`
        SELECT status::text AS label, COUNT(*)::int AS total
        FROM lecture_schedules
        GROUP BY status
        ORDER BY status::text
      `,
      prisma.$queryRaw`
        SELECT
          u.full_name AS label,
          COUNT(ls.id)::int AS total
        FROM teacher_profiles tp
        INNER JOIN users u ON u.id = tp.user_id
        LEFT JOIN lecture_schedules ls ON ls.teacher_id = tp.id
        GROUP BY u.full_name
        ORDER BY total DESC, u.full_name ASC
        LIMIT 10
      `,
      prisma.$queryRaw`
        SELECT
          u.full_name AS label,
          COUNT(ls.id)::int AS total
        FROM student_profiles sp
        INNER JOIN users u ON u.id = sp.user_id
        LEFT JOIN lecture_schedules ls ON ls.student_id = sp.id
        GROUP BY u.full_name
        ORDER BY total DESC, u.full_name ASC
        LIMIT 10
      `,
      prisma.$queryRaw`
        SELECT
          rl.id::text AS id,
          rl.student_name,
          rl.parent_name,
          rl.class_level,
          rl.status::text AS status,
          rl.created_at
        FROM registration_leads rl
        ORDER BY rl.created_at DESC NULLS LAST, rl.id DESC
        LIMIT 5
      `,
      prisma.$queryRaw`
        SELECT
          ls.id::text AS id,
          ls.title,
          ls.subject_name AS subject,
          u.full_name AS teacher,
          COALESCE(su.full_name, c.title) AS student_or_class,
          ls.scheduled_start,
          ls.status::text AS status
        FROM lecture_schedules ls
        LEFT JOIN teacher_profiles tp ON tp.id = ls.teacher_id
        LEFT JOIN users u ON u.id = tp.user_id
        LEFT JOIN student_profiles sp ON sp.id = ls.student_id
        LEFT JOIN users su ON su.id = sp.user_id
        LEFT JOIN courses c ON c.id = ls.course_id
        ORDER BY ls.created_at DESC NULLS LAST, ls.id DESC
        LIMIT 5
      `,
    ]);

    return json("Coordinator reports fetched.", 200, {
      registrationPipeline,
      feeVerification,
      lectureCompletion,
      teacherClassReport,
      studentActivity,
      recentLeads,
      recentLectures,
    });
  } catch (error) {
    const guard = roleGuardResponse(error);
    if (guard) {
      return guard;
    }

    return json(
      error instanceof Error ? error.message : "Unable to fetch coordinator reports.",
      500
    );
  }
}
