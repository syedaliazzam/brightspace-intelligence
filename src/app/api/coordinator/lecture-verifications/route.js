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
    const filter = normalizeText(searchParams.get("status")).toLowerCase();
    const conditions = [];

    if (filter === "pending") {
      conditions.push(Prisma.sql`LOWER(ls.status::text) = 'completed_by_teacher'`);
    } else if (filter === "verified") {
      conditions.push(Prisma.sql`LOWER(ls.status::text) = 'verified_by_coordinator'`);
    } else if (filter === "rejected") {
      conditions.push(Prisma.sql`LOWER(ls.status::text) IN ('disputed', 'missed')`);
    }

    const whereClause = conditions.length
      ? Prisma.sql`WHERE ${Prisma.join(conditions, Prisma.sql` AND `)}`
      : Prisma.empty;

    const [pendingRows, verifiedRows, rejectedRows, items] = await Promise.all([
      prisma.$queryRaw`SELECT COUNT(*)::int AS total FROM lecture_schedules WHERE status = 'completed_by_teacher'`,
      prisma.$queryRaw`SELECT COUNT(*)::int AS total FROM lecture_schedules WHERE status = 'verified_by_coordinator'`,
      prisma.$queryRaw`SELECT COUNT(*)::int AS total FROM lecture_schedules WHERE status IN ('disputed', 'missed')`,
      prisma.$queryRaw`
        SELECT
          ls.id::text AS id,
          ls.title,
          ls.status::text AS status,
          ls.scheduled_start,
          ls.scheduled_end,
          su.full_name AS student_name,
          tu.full_name AS teacher_name,
          sub.name AS subject_name,
          c.title AS course_title,
          lcr.summary,
          lcr.topic_covered,
          lcr.homework_given,
          lcr.student_performance,
          lv.decision::text AS decision,
          lv.remarks,
          COALESCE(teacher_att.status::text, 'absent') AS teacher_attendance_status,
          COALESCE(student_att.status::text, 'absent') AS student_attendance_status,
          teacher_att.duration_minutes AS teacher_duration_minutes,
          student_att.duration_minutes AS student_duration_minutes
        FROM lecture_schedules ls
        INNER JOIN enrollments e ON e.id = ls.enrollment_id
        INNER JOIN courses c ON c.id = e.course_id
        INNER JOIN student_profiles sp ON sp.id = ls.student_id
        INNER JOIN users su ON su.id = sp.user_id
        INNER JOIN teacher_profiles tp ON tp.id = ls.teacher_id
        INNER JOIN users tu ON tu.id = tp.user_id
        INNER JOIN subjects sub ON sub.id = ls.subject_id
        LEFT JOIN lecture_completion_reports lcr ON lcr.lecture_id = ls.id
        LEFT JOIN lecture_verifications lv ON lv.lecture_id = ls.id
        LEFT JOIN lecture_attendance teacher_att ON teacher_att.lecture_id = ls.id AND teacher_att.user_id = tu.id
        LEFT JOIN lecture_attendance student_att ON student_att.lecture_id = ls.id AND student_att.user_id = su.id
        ${whereClause}
        ORDER BY ls.scheduled_start DESC
      `,
    ]);

    return json("Lecture verifications fetched.", 200, {
      counts: {
        pending: Number(pendingRows?.[0]?.total || 0),
        verified: Number(verifiedRows?.[0]?.total || 0),
        rejected: Number(rejectedRows?.[0]?.total || 0),
      },
      items,
    });
  } catch (error) {
    const guard = roleGuardResponse(error);
    if (guard) {
      return guard;
    }

    return json(
      error instanceof Error ? error.message : "Unable to fetch lecture verifications.",
      500
    );
  }
}

