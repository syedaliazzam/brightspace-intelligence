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
    const pendingCondition = "(LOWER(ls.status::text) IN ('completed_by_teacher', 'live') OR (LOWER(ls.status::text) = 'scheduled' AND ls.scheduled_end < NOW()))";
    const historyCondition = `${pendingCondition} OR LOWER(ls.status::text) = 'verified_by_coordinator' OR LOWER(ls.status::text) IN ('disputed', 'missed')`;
    let whereClause = `WHERE ${pendingCondition}`;
    let orderClause = "ORDER BY ls.scheduled_start ASC";

    if (filter === "pending") {
      whereClause = `WHERE ${pendingCondition}`;
      orderClause = "ORDER BY ls.scheduled_start ASC";
    } else if (filter === "verified") {
      whereClause = "WHERE LOWER(ls.status::text) = 'verified_by_coordinator'";
      orderClause = "ORDER BY ls.scheduled_start DESC";
    } else if (filter === "rejected") {
      whereClause = "WHERE LOWER(ls.status::text) IN ('disputed', 'missed')";
      orderClause = "ORDER BY ls.scheduled_start DESC";
    } else if (filter === "all" || filter === "history") {
      whereClause = `WHERE ${historyCondition}`;
      orderClause = "ORDER BY ls.scheduled_start DESC";
    }

    const [pendingRows, verifiedRows, rejectedRows, items] = await Promise.all([
      prisma.$queryRaw`SELECT COUNT(*)::int AS total FROM lecture_schedules WHERE status IN ('completed_by_teacher','live') OR (status = 'scheduled' AND scheduled_end < NOW())`,
      prisma.$queryRaw`SELECT COUNT(*)::int AS total FROM lecture_schedules WHERE status = 'verified_by_coordinator'`,
      prisma.$queryRaw`SELECT COUNT(*)::int AS total FROM lecture_schedules WHERE status IN ('disputed', 'missed')`,
      prisma.$queryRawUnsafe(
        `
        SELECT
          ls.id::text AS lecture_id,
          ls.id::text AS id,
          ls.title,
          ls.description,
          ls.status::text AS status,
          ls.scheduled_start::text AS scheduled_start,
          ls.scheduled_end::text AS scheduled_end,
          ls.google_meet_link,
          su.full_name AS student_name,
          su.email AS student_email,
          su.phone AS student_phone,
          tu.full_name AS teacher_name,
          tu.email AS teacher_email,
          sub.name AS subject_name,
          COALESCE(NULLIF(c.class_level, ''), NULLIF(c.title, ''), 'Class') AS course_title,
          lcr.summary,
          lcr.topic_covered,
          lcr.homework_given,
          lcr.student_performance,
          lv.decision::text AS decision,
          lv.remarks,
          lv.verified_at,
          COALESCE(teacher_att.status::text, 'absent') AS teacher_attendance_status,
          COALESCE(student_att.status::text, 'absent') AS student_attendance_status,
          COALESCE(teacher_att.duration_minutes, 0) AS teacher_duration_minutes,
          COALESCE(student_att.duration_minutes, 0) AS student_duration_minutes,
          teacher_att.joined_at AS teacher_joined_at,
          teacher_att.left_at AS teacher_left_at,
          student_att.joined_at AS student_joined_at,
          student_att.left_at AS student_left_at,
          CASE WHEN teacher_att.joined_at IS NOT NULL THEN TRUE ELSE FALSE END AS teacher_joined,
          CASE WHEN student_att.joined_at IS NOT NULL THEN TRUE ELSE FALSE END AS student_joined,
          1::int AS total_students_count,
          CASE WHEN student_att.joined_at IS NOT NULL THEN 1 ELSE 0 END AS joined_students_count,
          CASE WHEN student_att.joined_at IS NOT NULL THEN 0 ELSE 1 END AS absent_students_count,
          GREATEST(
            COALESCE(teacher_att.updated_at, teacher_att.created_at),
            COALESCE(student_att.updated_at, student_att.created_at)
          ) AS attendance_synced_at
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
        ${orderClause}
        `
      ),
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
