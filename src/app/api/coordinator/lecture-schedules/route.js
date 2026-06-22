import crypto from "crypto";
import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { createAuditLog } from "@/lib/auditLog";
import { buildLectureJoinEmailHtml, getAppUrl, sendEmail } from "@/lib/email";
import { createCalendarLectureEvent } from "@/lib/googleCalendar";
import { requireRole, roleGuardResponse } from "@/lib/roleGuard";
import { CLASS_SUBJECTS } from "@/lib/academicCatalog";

const ALLOWED_ROLES = ["admin", "coordinator"];
const LOCAL_NOW_SQL = "CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Karachi'";
const DISPLAY_STATUS_SQL = `
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

function parseScheduleDate(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function isValidGoogleMeetLink(link) {
  const value = String(link || "").trim();
  return Boolean(value) && value.startsWith("https://meet.google.com/");
}

async function createNotifications(tx, userIds, title, message, type = "class") {
  const uniqueIds = [...new Set((userIds || []).filter(Boolean))];

  for (const userId of uniqueIds) {
    await tx.$executeRaw`
      INSERT INTO notifications (id, user_id, title, message, type, is_read, created_at)
      VALUES (
        ${crypto.randomUUID()}::uuid,
        ${userId}::uuid,
        ${title},
        ${message},
        ${type}::notification_type,
        FALSE,
        NOW()
      )
    `;
  }
}

async function sendLectureLinkEmails({ teacher, enrollmentRows, title, scheduledStart, meetLink }) {
  const baseUrl = getAppUrl();
  const recipients = [];

  if (teacher.email) {
    recipients.push({
      email: teacher.email,
      name: teacher.full_name,
      portalUrl: `${baseUrl}/teacher/dashboard`,
      studentName: enrollmentRows.length > 1 ? "Selected class students" : enrollmentRows[0]?.student_name,
      subjectName: enrollmentRows[0]?.subject_name,
    });
  }

  for (const enrollment of enrollmentRows) {
    const email = enrollment.student_email || enrollment.parent_email;
    if (!email) continue;

    recipients.push({
      email,
      name: enrollment.student_email ? enrollment.student_name : enrollment.parent_name,
      portalUrl: `${baseUrl}${enrollment.student_email ? "/student/dashboard" : "/parent/lectures"}`,
      studentName: enrollment.student_name,
      subjectName: enrollment.subject_name,
    });
  }

  for (const recipient of recipients) {
    try {
      await sendEmail({
        to: recipient.email,
        subject: "Your lecture joining link is available in portal",
        html: buildLectureJoinEmailHtml({
          recipientName: recipient.name,
          lectureTitle: title,
          studentName: recipient.studentName,
          subjectName: recipient.subjectName,
          scheduledStart,
          portalUrl: recipient.portalUrl,
          meetLink,
        }),
      });
    } catch (error) {
      console.warn("[lecture-schedules] Lecture email failed", {
        email: recipient.email,
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }
}

async function ensureEnrollmentOptions() {
  // First pass: create the ideal enrollment where student grade matches a course/class.
  await prisma.$executeRaw`
    INSERT INTO enrollments (
      id,
      student_id,
      course_id,
      registration_id,
      start_date,
      status,
      created_at,
      updated_at
    )
    SELECT
      gen_random_uuid(),
      sp.id,
      c.id,
      NULL,
      CURRENT_DATE,
      'active',
      NOW(),
      NOW()
    FROM student_profiles sp
    INNER JOIN users u ON u.id = sp.user_id
    INNER JOIN courses c ON (
      LOWER(NULLIF(c.class_level, '')) = LOWER(NULLIF(sp.grade_level, ''))
      OR LOWER(NULLIF(c.title, '')) = LOWER(NULLIF(sp.grade_level, ''))
    )
    WHERE u.status = 'active'::user_status
      AND COALESCE(sp.status, 'active'::user_status) = 'active'::user_status
      AND COALESCE(c.status, 'active'::user_status) = 'active'::user_status
      AND NULLIF(sp.grade_level, '') IS NOT NULL
      AND NOT EXISTS (
        SELECT 1
        FROM enrollments e
        WHERE e.student_id = sp.id
          AND e.course_id = c.id
      )
  `;

  // Fallback: if an active student still has no enrollment, attach them to the
  // first active course so coordinators can schedule classes without dead UI.
  await prisma.$executeRaw`
    INSERT INTO enrollments (
      id,
      student_id,
      course_id,
      registration_id,
      start_date,
      status,
      created_at,
      updated_at
    )
    SELECT
      gen_random_uuid(),
      sp.id,
      picked_course.id,
      NULL,
      CURRENT_DATE,
      'active',
      NOW(),
      NOW()
    FROM student_profiles sp
    INNER JOIN users u ON u.id = sp.user_id
    CROSS JOIN LATERAL (
      SELECT c.id
      FROM courses c
      WHERE COALESCE(c.status, 'active'::user_status) = 'active'::user_status
      ORDER BY
        CASE
          WHEN NULLIF(sp.grade_level, '') IS NOT NULL
            AND (
              LOWER(NULLIF(c.class_level, '')) = LOWER(NULLIF(sp.grade_level, ''))
              OR LOWER(NULLIF(c.title, '')) = LOWER(NULLIF(sp.grade_level, ''))
            )
          THEN 0
          ELSE 1
        END,
        c.created_at DESC NULLS LAST,
        c.id DESC
      LIMIT 1
    ) picked_course
    WHERE u.status = 'active'::user_status
      AND COALESCE(sp.status, 'active'::user_status) = 'active'::user_status
      AND NOT EXISTS (
        SELECT 1
        FROM enrollments e
        WHERE e.student_id = sp.id
      )
      AND NOT EXISTS (
        SELECT 1
        FROM enrollments e
        WHERE e.student_id = sp.id
          AND e.course_id = picked_course.id
      )
  `;
}

async function ensureCourseSubjectOptions() {
  for (const [classLevel, subjects] of Object.entries(CLASS_SUBJECTS)) {
    await prisma.$executeRaw(
      Prisma.sql`
        INSERT INTO course_subjects (course_id, subject_id)
        SELECT c.id, s.id
        FROM courses c
        INNER JOIN subjects s ON s.name IN (${Prisma.join(subjects)})
        WHERE (
            LOWER(NULLIF(c.class_level, '')) = LOWER(${classLevel})
            OR LOWER(NULLIF(c.title, '')) = LOWER(${classLevel})
          )
          AND NOT EXISTS (
            SELECT 1
            FROM course_subjects cs
            WHERE cs.course_id = c.id
              AND cs.subject_id = s.id
          )
      `
    );
  }
}

async function getScheduleOptions() {
  await ensureEnrollmentOptions();
  await ensureCourseSubjectOptions();

  const [students, enrollments, subjects, enrollmentSubjects, teachers] = await Promise.all([
    prisma.$queryRaw`
      SELECT sp.id::text AS id, u.full_name
      FROM student_profiles sp
      INNER JOIN users u ON u.id = sp.user_id
      WHERE u.status = 'active'
      ORDER BY u.full_name ASC
    `,
    prisma.$queryRaw`
      SELECT
        e.id::text AS id,
        e.student_id::text AS student_id,
        e.course_id::text AS course_id,
        u.full_name AS student_name,
        COALESCE(NULLIF(c.class_level, ''), NULLIF(c.title, ''), 'Class') AS course_title
      FROM enrollments e
      INNER JOIN student_profiles sp ON sp.id = e.student_id
      INNER JOIN users u ON u.id = sp.user_id
      INNER JOIN courses c ON c.id = e.course_id
      WHERE LOWER(e.status) = 'active'
      ORDER BY u.full_name ASC, c.title ASC
    `,
    prisma.$queryRaw`
      SELECT id::text AS id, name
      FROM subjects
      WHERE status = 'active'
      ORDER BY name ASC
    `,
    prisma.$queryRaw`
      SELECT
        e.id::text AS enrollment_id,
        s.id::text AS id,
        s.name
      FROM enrollments e
      INNER JOIN course_subjects cs ON cs.course_id = e.course_id
      INNER JOIN subjects s ON s.id = cs.subject_id
      WHERE LOWER(e.status) = 'active'
        AND COALESCE(s.status, 'active'::user_status) = 'active'::user_status
      ORDER BY s.name ASC
    `,
    prisma.$queryRaw`
      SELECT tp.id::text AS id, u.full_name
      FROM teacher_profiles tp
      INNER JOIN users u ON u.id = tp.user_id
      WHERE u.status = 'active'
      ORDER BY u.full_name ASC
    `,
  ]);

  return { students, enrollments, subjects, enrollmentSubjects, teachers };
}

export async function GET(request) {
  try {
    await requireRole(ALLOWED_ROLES);

    const { searchParams } = new URL(request.url);
    const search = normalizeText(searchParams.get("search"));
    const status = normalizeText(searchParams.get("status")).toLowerCase();
    const conditions = [];
    const values = [];

    if (search) {
      const term = `%${search}%`;
      values.push(term);
      conditions.push(`(
          ls.title ILIKE $${values.length}
          OR su.full_name ILIKE $${values.length}
          OR tu.full_name ILIKE $${values.length}
          OR sub.name ILIKE $${values.length}
          OR c.title ILIKE $${values.length}
        )`);
    }

    if (status) {
      values.push(status);
      conditions.push(`(${DISPLAY_STATUS_SQL}) = $${values.length}`);
    }

    const whereClause = conditions.length
      ? `WHERE ${conditions.join(" AND ")}`
      : "";

    const [items, options] = await Promise.all([
      prisma.$queryRawUnsafe(
        `
        SELECT
          MIN(ls.id::text) AS id,
          ls.google_calendar_event_id,
          ls.google_meet_link,
          ls.meet_link_source,
          ls.google_meet_space_id,
          ls.teacher_id::text AS teacher_id,
          ls.subject_id::text AS subject_id,
          ls.title,
          ls.description,
          MIN(ls.scheduled_start)::text AS scheduled_start,
          MIN(ls.scheduled_end)::text AS scheduled_end,
          ls.status::text AS status,
          ${DISPLAY_STATUS_SQL} AS display_status,
          ls.rescheduled_from_id::text AS rescheduled_from_id,
          tu.full_name AS teacher_name,
          sub.name AS subject_name,
          c.title AS course_title,
          COUNT(DISTINCT e.student_id)::int AS student_count,
          STRING_AGG(DISTINCT su.full_name, ', ') AS student_names
        FROM lecture_schedules ls
        INNER JOIN enrollments e ON e.id = ls.enrollment_id
        INNER JOIN courses c ON c.id = e.course_id
        INNER JOIN student_profiles sp ON sp.id = ls.student_id
        INNER JOIN users su ON su.id = sp.user_id
        INNER JOIN teacher_profiles tp ON tp.id = ls.teacher_id
        INNER JOIN users tu ON tu.id = tp.user_id
        INNER JOIN subjects sub ON sub.id = ls.subject_id
        ${whereClause}
        GROUP BY
          ls.google_calendar_event_id,
          ls.google_meet_link,
          ls.meet_link_source,
          ls.google_meet_space_id,
          ls.teacher_id,
          ls.subject_id,
          ls.title,
          ls.description,
          ls.status,
          ${DISPLAY_STATUS_SQL},
          ls.rescheduled_from_id,
          tu.full_name,
          sub.name,
          c.title
        ORDER BY MIN(ls.scheduled_start) ASC
        `,
        ...values
      ),
      getScheduleOptions(),
    ]);

    return json("Lecture schedules fetched.", 200, { items, ...options });
  } catch (error) {
    const guard = roleGuardResponse(error);
    if (guard) {
      return guard;
    }

    return json(
      error instanceof Error ? error.message : "Unable to fetch lecture schedules.",
      500
    );
  }
}

export async function POST(request) {
  try {
    const session = await requireRole(ALLOWED_ROLES);
    const body = await request.json();
    const courseId = normalizeText(body?.courseId || body?.course_id);
    const studentIds = Array.isArray(body?.studentIds)
      ? body.studentIds.map(normalizeText).filter(Boolean)
      : Array.isArray(body?.student_ids)
        ? body.student_ids.map(normalizeText).filter(Boolean)
        : [];
    const teacherId = normalizeText(body?.teacherId);
    const subjectId = normalizeText(body?.subjectId);
    const title = normalizeText(body?.title);
    const description = normalizeText(body?.description);
    const scheduledStart = normalizeText(body?.scheduledStart || body?.scheduled_start);
    const scheduledEnd = normalizeText(body?.scheduledEnd || body?.scheduled_end);
    const manualMeetLink = normalizeText(body?.googleMeetLink || body?.google_meet_link);

    if (!courseId || !studentIds.length || !teacherId || !subjectId || !title || !scheduledStart || !scheduledEnd) {
      return json("Class, students, teacher, subject, title, and schedule times are required.", 400);
    }

    if (!isValidGoogleMeetLink(manualMeetLink)) {
      return json("Google Meet link is required.", 400);
    }

    const startDate = parseScheduleDate(scheduledStart);
    const endDate = parseScheduleDate(scheduledEnd);

    if (!startDate || !endDate) {
      return json("Please provide valid lecture start and end times.", 400);
    }

    if (endDate <= startDate) {
      return json("Lecture end time must be later than the start time.", 400);
    }

    const [course] = await prisma.$queryRaw`
      SELECT id::text AS id
      FROM courses
      WHERE id = ${courseId}::uuid
        AND COALESCE(status, 'active'::user_status) = 'active'::user_status
      LIMIT 1
    `;

    if (!course?.id) {
      return json("Class not found.", 404);
    }

    const [subjectAllowed] = await prisma.$queryRaw`
      SELECT s.id::text AS id
      FROM course_subjects cs
      INNER JOIN subjects s ON s.id = cs.subject_id
      WHERE cs.course_id = ${courseId}::uuid
        AND s.id = ${subjectId}::uuid
      LIMIT 1
    `;

    if (!subjectAllowed?.id) {
      return json("Selected subject is not available for this student's class.", 400);
    }

    const [teacher] = await prisma.$queryRaw`
      SELECT tp.id::text AS id, u.id::text AS user_id, u.email, u.full_name
      FROM teacher_profiles tp
      INNER JOIN users u ON u.id = tp.user_id
      WHERE tp.id = ${teacherId}::uuid
        AND u.status = 'active'::user_status
      LIMIT 1
    `;

    if (!teacher?.id) {
      return json("Teacher not found.", 404);
    }

    const [teacherAssigned] = await prisma.$queryRaw`
      SELECT id::text AS id
      FROM teacher_assignments
      WHERE teacher_id = ${teacherId}::uuid
        AND course_id = ${courseId}::uuid
        AND subject_id = ${subjectId}::uuid
        AND student_id IS NULL
        AND status = 'active'::user_status
      LIMIT 1
    `;

    if (!teacherAssigned?.id) {
      return json("Selected teacher is not assigned to this class subject.", 400);
    }

    const selectedStudentSql = studentIds.map((id) => Prisma.sql`${id}::uuid`);
    const enrollmentRows = await prisma.$queryRaw(
      Prisma.sql`
        SELECT
          e.id::text AS enrollment_id,
          e.student_id::text AS student_id,
          su.id::text AS student_user_id,
          su.full_name AS student_name,
          su.email AS student_email,
          pu.id::text AS parent_user_id,
          pu.email AS parent_email,
          pu.full_name AS parent_name,
          sub.name AS subject_name
        FROM enrollments e
        INNER JOIN student_profiles sp ON sp.id = e.student_id
        INNER JOIN users su ON su.id = sp.user_id
        INNER JOIN subjects sub ON sub.id = ${subjectId}::uuid
        LEFT JOIN student_parents spp ON spp.student_id = sp.id AND spp.is_primary = TRUE
        LEFT JOIN parent_profiles pp ON pp.id = spp.parent_id
        LEFT JOIN users pu ON pu.id = pp.user_id
        WHERE e.course_id = ${courseId}::uuid
          AND e.student_id IN (${Prisma.join(selectedStudentSql)})
          AND LOWER(e.status) = 'active'
          AND COALESCE(sp.status, 'active'::user_status) = 'active'::user_status
          AND su.status = 'active'::user_status
        ORDER BY su.full_name ASC
      `
    );

    if (enrollmentRows.length !== studentIds.length) {
      return json("One or more selected students are not enrolled in this class.", 400);
    }

    const calendarData = { eventId: "", meetSpaceId: "", meetLink: manualMeetLink };
    const resolvedMeetLink = manualMeetLink;
    const resolvedMeetSource = "manual";

    const created = await prisma.$transaction(async (tx) => {
      const createdRows = [];

      for (const enrollment of enrollmentRows) {
        const rows = await tx.$queryRaw`
        INSERT INTO lecture_schedules (
          id,
          enrollment_id,
          student_id,
          teacher_id,
          subject_id,
          scheduled_by,
          title,
          description,
          scheduled_start,
          scheduled_end,
          google_calendar_event_id,
          google_meet_link,
          meet_link_source,
          google_meet_space_id,
          status,
          created_at,
          updated_at
        )
        VALUES (
          ${crypto.randomUUID()}::uuid,
          ${enrollment.enrollment_id}::uuid,
          ${enrollment.student_id}::uuid,
          ${teacherId}::uuid,
          ${subjectId}::uuid,
          ${session.user.id}::uuid,
          ${title},
          ${description || null},
          ${scheduledStart}::timestamp,
          ${scheduledEnd}::timestamp,
          ${calendarData.eventId || null},
          ${resolvedMeetLink || null},
          ${resolvedMeetSource},
          ${calendarData.meetSpaceId || null},
          'scheduled'::lecture_status,
          NOW(),
          NOW()
        )
        RETURNING id::text AS id
      `;
        createdRows.push(rows[0]);

        await createNotifications(
          tx,
          [teacher.user_id, enrollment.student_user_id, enrollment.parent_user_id],
          "New lecture scheduled",
          `${title} is scheduled for ${enrollment.student_name}.${resolvedMeetLink ? ` Join: ${resolvedMeetLink}` : ""}`,
          "class"
        );
      }

      await createAuditLog(
        {
          actorUserId: session.user.id,
          action: "lecture_scheduled",
          entityType: "lecture_schedules",
          entityId: createdRows[0].id,
          newData: {
            teacherId,
            subjectId,
            courseId,
            studentIds,
            scheduledStart,
            scheduledEnd,
          },
        },
        tx
      );

      return tx.$queryRaw`
        SELECT
          ls.id::text AS id,
          ls.enrollment_id::text AS enrollment_id,
          ls.student_id::text AS student_id,
          ls.teacher_id::text AS teacher_id,
          ls.subject_id::text AS subject_id,
          ls.title,
          ls.description,
          ls.scheduled_start::text AS scheduled_start,
          ls.scheduled_end::text AS scheduled_end,
          ls.status::text AS status,
          ls.google_calendar_event_id,
          ls.google_meet_link,
          ls.meet_link_source,
          ls.google_meet_space_id,
          ls.rescheduled_from_id::text AS rescheduled_from_id,
          su.full_name AS student_name,
          tu.full_name AS teacher_name,
          sub.name AS subject_name,
          c.title AS course_title
        FROM lecture_schedules ls
        INNER JOIN enrollments e ON e.id = ls.enrollment_id
        INNER JOIN courses c ON c.id = e.course_id
        INNER JOIN student_profiles sp ON sp.id = ls.student_id
        INNER JOIN users su ON su.id = sp.user_id
        INNER JOIN teacher_profiles tp ON tp.id = ls.teacher_id
        INNER JOIN users tu ON tu.id = tp.user_id
        INNER JOIN subjects sub ON sub.id = ls.subject_id
        WHERE ls.id IN (${Prisma.join(createdRows.map((row) => Prisma.sql`${row.id}::uuid`))})
        ORDER BY ls.scheduled_start ASC, su.full_name ASC
      `;
    });

    await sendLectureLinkEmails({
      teacher,
      enrollmentRows,
      title,
      scheduledStart,
      meetLink: resolvedMeetLink,
    });

    return json("Lectures scheduled.", 201, {
      item: created[0] || null,
      items: created,
      createdCount: created.length,
    });
  } catch (error) {
    const guard = roleGuardResponse(error);
    if (guard) {
      return guard;
    }

    return json(
      error instanceof Error ? error.message : "Unable to schedule lecture.",
      500
    );
  }
}
