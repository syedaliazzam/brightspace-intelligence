import { NextResponse } from "next/server";
import { requireRole, roleGuardResponse } from "@/lib/roleGuard";
import prisma from "@/lib/prisma";
import { getCurrentWeekRange, getDayRange, getNextWeekRange } from "@/lib/dateTime";

const ALLOWED_ROLES = ["teacher", "admin"];
const VALID_RANGES = new Set(["all", "today", "current_week", "next_week", "selected_date", "upcoming", "completed"]);
const LOCAL_NOW_SQL = "CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Karachi'";

function json(message, status = 200, extra = {}) {
  return NextResponse.json({ message, ...extra }, { status });
}

function clean(value) {
  return typeof value === "string" ? value.trim() : "";
}

function isoDate(value) {
  const date = value ? new Date(value) : new Date();
  if (Number.isNaN(date.getTime())) return new Date().toISOString().slice(0, 10);
  return date.toISOString().slice(0, 10);
}

async function getTeacherId(session) {
  if (String(session.user.role).toLowerCase() === "admin") return "";

  const [teacher] = await prisma.$queryRaw`
    SELECT id::text AS id
    FROM teacher_profiles
    WHERE user_id = ${session.user.id}::uuid
    LIMIT 1
  `;

  if (!teacher?.id) throw new Error("Teacher profile not found.");
  return teacher.id;
}

export async function GET(request) {
  try {
    const session = await requireRole(ALLOWED_ROLES);
    const teacherId = await getTeacherId(session);
    const { searchParams } = new URL(request.url);
    const range = VALID_RANGES.has(clean(searchParams.get("range"))) ? clean(searchParams.get("range")) : "selected_date";
    const selectedDate = isoDate(searchParams.get("date"));
    const subjectId = clean(searchParams.get("subjectId"));
    const status = clean(searchParams.get("status")).toLowerCase();

    const conditions = [];
    const values = [];

    if (teacherId) {
      values.push(teacherId);
      conditions.push(`ls.teacher_id = $${values.length}::uuid`);
    }

    let rangeStart = null;
    let rangeEnd = null;

    if (range === "all") {
      conditions.push("TRUE");
    } else if (range === "today") {
      const rangeValues = getDayRange(new Date());
      rangeStart = rangeValues?.start;
      rangeEnd = rangeValues?.end;
    } else if (range === "current_week") {
      const weekRange = getCurrentWeekRange(new Date());
      rangeStart = weekRange?.start;
      rangeEnd = weekRange?.end;
    } else if (range === "next_week") {
      const nextWeekRange = getNextWeekRange(new Date());
      rangeStart = nextWeekRange?.start;
      rangeEnd = nextWeekRange?.end;
    } else if (range === "upcoming") {
      conditions.push(`ls.scheduled_start >= ${LOCAL_NOW_SQL}`);
      conditions.push("ls.status::text IN ('scheduled','upcoming','live')");
    } else if (range === "completed") {
      conditions.push("ls.status::text IN ('completed_by_teacher','verified_by_coordinator')");
    } else {
      const dayRange = getDayRange(selectedDate);
      rangeStart = dayRange?.start;
      rangeEnd = dayRange?.end;
    }

    if (rangeStart && rangeEnd) {
      values.push(rangeStart, rangeEnd);
      conditions.push(`ls.scheduled_start >= $${values.length - 1}::timestamp`);
      conditions.push(`ls.scheduled_start <= $${values.length}::timestamp`);
    }

    if (subjectId) {
      values.push(subjectId);
      conditions.push(`ls.subject_id = $${values.length}::uuid`);
    }

    if (status) {
      values.push(status);
      conditions.push(`LOWER(
        CASE
          WHEN ls.status::text IN ('completed_by_teacher', 'verified_by_coordinator', 'missed', 'cancelled', 'rescheduled', 'disputed') THEN ls.status::text
          WHEN ls.scheduled_start > ${LOCAL_NOW_SQL} THEN 'upcoming'
          WHEN ls.scheduled_start <= ${LOCAL_NOW_SQL} AND ls.scheduled_end >= ${LOCAL_NOW_SQL} THEN 'live'
          ELSE 'ended'
        END
      ) = $${values.length}`);
    }

    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
    const [lectures, subjects, markedDates] = await Promise.all([
      prisma.$queryRawUnsafe(
        `
        WITH lecture_state AS (
          SELECT
            ls.*,
            LOWER(
              CASE
                WHEN ls.status::text IN ('completed_by_teacher', 'verified_by_coordinator', 'missed', 'cancelled', 'rescheduled', 'disputed') THEN ls.status::text
                WHEN ls.scheduled_start > ${LOCAL_NOW_SQL} THEN 'upcoming'
                WHEN ls.scheduled_start <= ${LOCAL_NOW_SQL} AND ls.scheduled_end >= ${LOCAL_NOW_SQL} THEN 'live'
                ELSE 'ended'
              END
            ) AS display_status
          FROM lecture_schedules ls
        )
        SELECT
          MIN(ls.id::text) AS id,
          ls.google_calendar_event_id,
          ls.google_meet_link,
          ls.meet_link_source,
          ls.title,
          ls.description,
          ls.teacher_id::text AS teacher_id,
          ls.subject_id::text AS subject_id,
          MIN(ls.scheduled_start)::text AS scheduled_start,
          MIN(ls.scheduled_end)::text AS scheduled_end,
          ls.status::text AS status,
          ls.display_status AS display_status,
          COUNT(DISTINCT sp.id)::int AS student_count,
          STRING_AGG(DISTINCT su.full_name, ', ' ORDER BY su.full_name) AS student_name,
          sub.name AS subject_name
        FROM lecture_state ls
        INNER JOIN student_profiles sp ON sp.id = ls.student_id
        INNER JOIN users su ON su.id = sp.user_id
        INNER JOIN subjects sub ON sub.id = ls.subject_id
        ${where}
        GROUP BY
          ls.google_calendar_event_id,
          ls.google_meet_link,
          ls.meet_link_source,
          ls.title,
          ls.description,
          ls.teacher_id,
          ls.subject_id,
          ls.status,
          ls.display_status,
          sub.name
        ORDER BY MIN(ls.scheduled_start) ASC
        `,
        ...values
      ),
      prisma.$queryRawUnsafe(
        `
        SELECT DISTINCT sub.id::text AS id, sub.name
        FROM lecture_schedules ls
        INNER JOIN subjects sub ON sub.id = ls.subject_id
        ${teacherId ? "WHERE ls.teacher_id = $1::uuid" : ""}
        ORDER BY sub.name ASC
        `,
        ...(teacherId ? [teacherId] : [])
      ),
      prisma.$queryRawUnsafe(
        `
        SELECT DISTINCT TO_CHAR(ls.scheduled_start, 'YYYY-MM-DD') AS date
        FROM lecture_schedules ls
        ${teacherId ? "WHERE ls.teacher_id = $1::uuid" : ""}
        ORDER BY date ASC
        `,
        ...(teacherId ? [teacherId] : [])
      ),
    ]);

    return json("Calendar lectures fetched.", 200, {
      items: lectures,
      subjects,
      markedDates,
      selectedDate,
      range,
    });
  } catch (error) {
    const guard = roleGuardResponse(error);
    return guard || json(error instanceof Error ? error.message : "Unable to load calendar lectures.", 500);
  }
}
