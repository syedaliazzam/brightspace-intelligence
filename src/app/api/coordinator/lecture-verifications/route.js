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

async function ensureLectureVerificationColumns() {
  await prisma.$executeRaw`
    ALTER TABLE lecture_schedules
    ADD COLUMN IF NOT EXISTS google_meet_sync_meta JSONB
  `;
}

export async function GET(request) {
  try {
    await requireRole(ALLOWED_ROLES);
    await ensureLectureVerificationColumns();

    const { searchParams } = new URL(request.url);
    const filter = normalizeText(searchParams.get("status")).toLowerCase();
    const needsReviewCondition = `
      ls.status::text = 'completed_by_teacher'
      AND NOT EXISTS (
        SELECT 1
        FROM lecture_verifications lv2
        WHERE lv2.lecture_id = ls.id
          AND LOWER(lv2.decision::text) = 'approved'
      )
    `;
    const approvedCondition = `
      (
        ls.status::text = 'verified_by_coordinator'
        OR EXISTS (
          SELECT 1
          FROM lecture_verifications lv2
          WHERE lv2.lecture_id = ls.id
            AND LOWER(lv2.decision::text) = 'approved'
        )
      )
    `;
    const rejectedCondition = `
      EXISTS (
        SELECT 1
        FROM lecture_verifications lv2
        WHERE lv2.lecture_id = ls.id
          AND LOWER(lv2.decision::text) = 'rejected'
      )
    `;
    const missedCondition = `ls.status::text = 'missed'`;
    let whereClause = `WHERE ${needsReviewCondition}`;
    let orderClause = "ORDER BY ls.scheduled_start ASC";

    if (filter === "pending") {
      whereClause = `WHERE ${needsReviewCondition}`;
      orderClause = "ORDER BY ls.scheduled_start ASC";
    } else if (filter === "verified") {
      whereClause = `WHERE ${approvedCondition}`;
      orderClause = "ORDER BY ls.scheduled_start DESC";
    } else if (filter === "rejected") {
      whereClause = `WHERE ${rejectedCondition} OR ${missedCondition}`;
      orderClause = "ORDER BY ls.scheduled_start DESC";
    } else if (filter === "missed") {
      whereClause = `WHERE ${missedCondition}`;
      orderClause = "ORDER BY ls.scheduled_start DESC";
    } else if (filter === "all" || filter === "history") {
      whereClause = `WHERE ${needsReviewCondition} OR ${approvedCondition} OR ${rejectedCondition} OR ${missedCondition}`;
      orderClause = "ORDER BY ls.scheduled_start DESC";
    }

    const [pendingRows, verifiedRows, rejectedRows, items] = await Promise.all([
      prisma.$queryRawUnsafe(
        `SELECT COUNT(DISTINCT ls.id)::int AS total FROM lecture_schedules ls WHERE ${needsReviewCondition}`
      ),
      prisma.$queryRawUnsafe(
        `SELECT COUNT(DISTINCT ls.id)::int AS total FROM lecture_schedules ls WHERE ${approvedCondition}`
      ),
      prisma.$queryRawUnsafe(
        `SELECT COUNT(DISTINCT ls.id)::int AS total FROM lecture_schedules ls WHERE ${rejectedCondition} OR ${missedCondition}`
      ),
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
          ls.recording_drive_url,
          ls.google_meet_sync_meta,
          cu.full_name AS coordinator_name,
          cu.email AS coordinator_email,
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
          COALESCE(attendance_rows.rows, '[]'::jsonb) AS attendance_rows,
          COALESCE(attendance_rows.total_students_count, 0) AS total_students_count,
          COALESCE(attendance_rows.joined_students_count, 0) AS joined_students_count,
          COALESCE(attendance_rows.absent_students_count, 0) AS absent_students_count,
          COALESCE(teacher_att.status::text, 'absent') AS teacher_attendance_status,
          COALESCE(teacher_att.duration_minutes, 0) AS teacher_duration_minutes,
          teacher_att.joined_at AS teacher_joined_at,
          teacher_att.left_at AS teacher_left_at,
          CASE WHEN teacher_att.joined_at IS NOT NULL THEN TRUE ELSE FALSE END AS teacher_joined,
          COALESCE(coordinator_att.status::text, 'absent') AS coordinator_attendance_status,
          COALESCE(coordinator_att.duration_minutes, 0) AS coordinator_duration_minutes,
          coordinator_att.joined_at AS coordinator_joined_at,
          coordinator_att.left_at AS coordinator_left_at,
          CASE WHEN coordinator_att.joined_at IS NOT NULL THEN TRUE ELSE FALSE END AS coordinator_joined,
          FALSE AS student_joined,
          GREATEST(
            COALESCE(teacher_att.updated_at, teacher_att.created_at),
            COALESCE(attendance_rows.updated_at, attendance_rows.created_at)
          ) AS attendance_synced_at
        FROM lecture_schedules ls
        INNER JOIN enrollments e ON e.id = ls.enrollment_id
        INNER JOIN courses c ON c.id = e.course_id
        INNER JOIN teacher_profiles tp ON tp.id = ls.teacher_id
        INNER JOIN users tu ON tu.id = tp.user_id
        LEFT JOIN users cu ON cu.id = ls.scheduled_by
        INNER JOIN subjects sub ON sub.id = ls.subject_id
          LEFT JOIN lecture_completion_reports lcr ON lcr.lecture_id = ls.id
          LEFT JOIN lecture_verifications lv ON lv.lecture_id = ls.id
          LEFT JOIN lecture_attendance teacher_att ON teacher_att.lecture_id = ls.id AND teacher_att.user_id = tu.id
          LEFT JOIN lecture_attendance coordinator_att ON coordinator_att.lecture_id = ls.id AND coordinator_att.user_id = cu.id
          LEFT JOIN LATERAL (
            SELECT
            jsonb_agg(
              jsonb_build_object(
                'id', roster.student_id,
                'user_id', roster.user_id,
                'student_name', roster.student_name,
                'username', roster.username,
                'student_email', roster.student_email,
                'student_phone', roster.student_phone,
                'status', roster.status,
                'source', roster.source,
                'joined_at', roster.joined_at,
                'left_at', roster.left_at,
                'duration_minutes', roster.duration_minutes
              )
              ORDER BY roster.student_sort_name ASC, roster.student_name ASC
            ) AS rows,
            COUNT(*)::int AS total_students_count,
            COUNT(*) FILTER (WHERE roster.status IN ('present', 'partial'))::int AS joined_students_count,
            COUNT(*) FILTER (WHERE roster.status = 'absent')::int AS absent_students_count,
            MAX(roster.updated_at) AS updated_at,
            MAX(roster.created_at) AS created_at
          FROM (
            SELECT
              sp.id::text AS student_id,
              su2.id::text AS user_id,
              su2.full_name AS student_name,
              su2.username,
              su2.email AS student_email,
              su2.phone AS student_phone,
              COALESCE(la2.status::text, 'absent') AS status,
              la2.source::text AS source,
              la2.joined_at,
              la2.left_at,
              COALESCE(la2.duration_minutes, 0) AS duration_minutes,
              COALESCE(NULLIF(LOWER(TRIM(su2.username)), ''), LOWER(TRIM(su2.full_name))) AS student_sort_name,
              la2.updated_at,
              la2.created_at
            FROM enrollments e2
            INNER JOIN student_profiles sp ON sp.id = e2.student_id
            INNER JOIN users su2 ON su2.id = sp.user_id
            LEFT JOIN lecture_attendance la2
              ON la2.lecture_id = ls.id
             AND la2.user_id = su2.id
             AND la2.role_type = 'student'
            WHERE e2.course_id = e.course_id
              AND LOWER(e2.status::text) = 'active'
          ) roster
        ) attendance_rows ON TRUE
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
