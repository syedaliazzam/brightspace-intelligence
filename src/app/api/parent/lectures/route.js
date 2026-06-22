import { NextResponse } from "next/server";
import { requireRole, roleGuardResponse } from "@/lib/roleGuard";
import prisma from "@/lib/prisma";
import { getCurrentWeekRange, getNextWeekRange } from "@/lib/dateTime";

const ALLOWED_ROLES = ["parent", "admin"];
const LOCAL_NOW_SQL = "CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Karachi'";
const LECTURE_STATUS_SQL = `
  LOWER(
    CASE
      WHEN ls.status::text IN ('completed_by_teacher', 'verified_by_coordinator', 'missed', 'cancelled', 'rescheduled', 'disputed') THEN ls.status::text
      WHEN ls.scheduled_start > ${LOCAL_NOW_SQL} THEN 'upcoming'
      WHEN ls.scheduled_start <= ${LOCAL_NOW_SQL} AND ls.scheduled_end >= ${LOCAL_NOW_SQL} THEN 'live'
      ELSE 'ended'
    END
  )
`;

function json(message, status = 200, extra = {}) {
  return NextResponse.json({ message, ...extra }, { status });
}

function normalizeText(value) {
  return typeof value === "string" ? value.trim() : "";
}

function getScope(session, childId) {
  const role = String(session?.user?.role || "").toLowerCase();
  if (role === "admin") {
    return childId
      ? { joins: "", where: "WHERE sp.id = $1::uuid", values: [childId] }
      : { joins: "", where: "", values: [] };
  }
  return childId
    ? {
        joins: "INNER JOIN student_parents spp ON spp.student_id = sp.id INNER JOIN parent_profiles pp ON pp.id = spp.parent_id",
        where: "WHERE pp.user_id = $1::uuid AND sp.id = $2::uuid",
        values: [session.user.id, childId],
      }
    : {
        joins: "INNER JOIN student_parents spp ON spp.student_id = sp.id INNER JOIN parent_profiles pp ON pp.id = spp.parent_id",
        where: "WHERE pp.user_id = $1::uuid",
        values: [session.user.id],
      };
}

export async function GET(request) {
  try {
    const session = await requireRole(ALLOWED_ROLES);
    const { searchParams } = new URL(request.url);
    const scope = getScope(session, normalizeText(searchParams.get("childId")));
    const period = normalizeText(searchParams.get("period")).toLowerCase();
    let extra = "";
    if (period === "current_week") {
      const weekRange = getCurrentWeekRange(new Date());
      if (weekRange?.start && weekRange?.end) {
        const placeholderStart = scope.values.length + 1;
        const placeholderEnd = scope.values.length + 2;
        scope.values.push(weekRange.start, weekRange.end);
        extra = `${scope.where ? "AND" : "WHERE"} ls.scheduled_start >= $${placeholderStart}::timestamp AND ls.scheduled_start <= $${placeholderEnd}::timestamp`;
      }
    } else if (period === "next_week") {
      const nextWeekRange = getNextWeekRange(new Date());
      if (nextWeekRange?.start && nextWeekRange?.end) {
        const placeholderStart = scope.values.length + 1;
        const placeholderEnd = scope.values.length + 2;
        scope.values.push(nextWeekRange.start, nextWeekRange.end);
        extra = `${scope.where ? "AND" : "WHERE"} ls.scheduled_start >= $${placeholderStart}::timestamp AND ls.scheduled_start <= $${placeholderEnd}::timestamp`;
      }
    } else if (period === "upcoming") {
      extra = `${scope.where ? "AND" : "WHERE"} ls.scheduled_start >= ${LOCAL_NOW_SQL} AND LOWER(ls.status::text) IN ('scheduled', 'upcoming', 'live')`;
    } else if (period === "completed") {
      extra = `${scope.where ? "AND" : "WHERE"} LOWER(ls.status::text) IN ('completed_by_teacher', 'verified_by_coordinator')`;
    }

    const items = await prisma.$queryRawUnsafe(
      `
      SELECT
        ls.id::text AS id,
        ls.title,
        ls.description,
        ls.scheduled_start::text AS scheduled_start,
        ls.scheduled_end::text AS scheduled_end,
        ls.status::text AS status,
        ${LECTURE_STATUS_SQL} AS display_status,
        ls.google_meet_link,
        ls.recording_drive_url,
        sub.name AS subject_name,
        tu.full_name AS teacher_name,
        su.full_name AS student_name,
        c.title AS course_title
      FROM lecture_schedules ls
      INNER JOIN enrollments e ON e.id = ls.enrollment_id
      INNER JOIN course_subjects cs ON cs.course_id = e.course_id AND cs.subject_id = ls.subject_id
      INNER JOIN student_profiles sp ON sp.id = e.student_id
      INNER JOIN users su ON su.id = sp.user_id
      INNER JOIN teacher_profiles tp ON tp.id = ls.teacher_id
      INNER JOIN users tu ON tu.id = tp.user_id
      INNER JOIN subjects sub ON sub.id = ls.subject_id
      INNER JOIN courses c ON c.id = e.course_id
      ${scope.joins}
      ${scope.where}
      ${extra}
      ORDER BY ls.scheduled_start ASC
      `,
      ...scope.values
    );

    return json("Lecture fetched.", 200, { items });
  } catch (error) {
    const guard = roleGuardResponse(error);
    return guard || json(error instanceof Error ? error.message : "Unable to load lectures.", 500);
  }
}
