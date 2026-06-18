import crypto from "crypto";
import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { createAuditLog } from "@/lib/auditLog";
import { createCalendarLectureEvent } from "@/lib/googleCalendar";
import { requireRole, roleGuardResponse } from "@/lib/roleGuard";

const ALLOWED_ROLES = ["admin", "coordinator"];

function json(message, status = 200, extra = {}) {
  return NextResponse.json({ message, ...extra }, { status });
}

function normalizeText(value) {
  return typeof value === "string" ? value.trim() : "";
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

async function getScheduleOptions() {
  const [students, enrollments, subjects, teachers] = await Promise.all([
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
        c.title AS course_title
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
      SELECT tp.id::text AS id, u.full_name
      FROM teacher_profiles tp
      INNER JOIN users u ON u.id = tp.user_id
      WHERE u.status = 'active'
      ORDER BY u.full_name ASC
    `,
  ]);

  return { students, enrollments, subjects, teachers };
}

export async function GET(request) {
  try {
    await requireRole(ALLOWED_ROLES);

    const { searchParams } = new URL(request.url);
    const search = normalizeText(searchParams.get("search"));
    const status = normalizeText(searchParams.get("status")).toLowerCase();
    const conditions = [];

    if (search) {
      const term = `%${search}%`;
      conditions.push(
        Prisma.sql`(
          ls.title ILIKE ${term}
          OR su.full_name ILIKE ${term}
          OR tu.full_name ILIKE ${term}
          OR sub.name ILIKE ${term}
          OR c.title ILIKE ${term}
        )`
      );
    }

    if (status) {
      conditions.push(Prisma.sql`LOWER(ls.status::text) = ${status}`);
    }

    const whereClause = conditions.length
      ? Prisma.sql`WHERE ${Prisma.join(conditions, Prisma.sql` AND `)}`
      : Prisma.empty;

    const [items, options] = await Promise.all([
      prisma.$queryRaw`
        SELECT
          ls.id::text AS id,
          ls.enrollment_id::text AS enrollment_id,
          ls.student_id::text AS student_id,
          ls.teacher_id::text AS teacher_id,
          ls.subject_id::text AS subject_id,
          ls.title,
          ls.description,
          ls.scheduled_start,
          ls.scheduled_end,
          ls.status::text AS status,
          ls.google_calendar_event_id,
          ls.google_meet_link,
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
        ${whereClause}
        ORDER BY ls.scheduled_start DESC
      `,
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
    const enrollmentId = normalizeText(body?.enrollmentId);
    const studentId = normalizeText(body?.studentId);
    const teacherId = normalizeText(body?.teacherId);
    const subjectId = normalizeText(body?.subjectId);
    const title = normalizeText(body?.title);
    const description = normalizeText(body?.description);
    const scheduledStart = normalizeText(body?.scheduledStart);
    const scheduledEnd = normalizeText(body?.scheduledEnd);

    if (!enrollmentId || !studentId || !teacherId || !subjectId || !title || !scheduledStart || !scheduledEnd) {
      return json("Enrollment, student, teacher, subject, title, and schedule times are required.", 400);
    }

    const [enrollment] = await prisma.$queryRaw`
      SELECT
        e.id::text AS id,
        e.course_id::text AS course_id,
        c.title AS course_title,
        su.id::text AS student_user_id,
        su.full_name AS student_name,
        pu.id::text AS parent_user_id,
        pu.email AS parent_email,
        pu.phone AS parent_phone,
        pu.full_name AS parent_name,
        tu.id::text AS teacher_user_id,
        tu.email AS teacher_email,
        tu.full_name AS teacher_name,
        sub.name AS subject_name
      FROM enrollments e
      INNER JOIN courses c ON c.id = e.course_id
      INNER JOIN student_profiles sp ON sp.id = e.student_id
      INNER JOIN users su ON su.id = sp.user_id
      INNER JOIN teacher_profiles tp ON tp.id = ${teacherId}::uuid
      INNER JOIN users tu ON tu.id = tp.user_id
      INNER JOIN subjects sub ON sub.id = ${subjectId}::uuid
      LEFT JOIN student_parents spp ON spp.student_id = sp.id AND spp.is_primary = TRUE
      LEFT JOIN parent_profiles pp ON pp.id = spp.parent_id
      LEFT JOIN users pu ON pu.id = pp.user_id
      WHERE e.id = ${enrollmentId}::uuid
      LIMIT 1
    `;

    if (!enrollment?.id) {
      return json("Enrollment not found.", 404);
    }

    let calendarData = {
      eventId: "",
      meetLink: "",
      meetSpaceId: "",
    };

    try {
      calendarData = await createCalendarLectureEvent({
        title,
        description:
          description ||
          `${enrollment.student_name} with ${enrollment.teacher_name} for ${enrollment.subject_name}.`,
        start: scheduledStart,
        end: scheduledEnd,
        attendees: [
          { email: enrollment.teacher_email, name: enrollment.teacher_name },
          { email: enrollment.parent_email, name: enrollment.parent_name },
        ],
      });
    } catch {}

    const [created] = await prisma.$transaction(async (tx) => {
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
          google_meet_space_id,
          status,
          created_at,
          updated_at
        )
        VALUES (
          ${crypto.randomUUID()}::uuid,
          ${enrollmentId}::uuid,
          ${studentId}::uuid,
          ${teacherId}::uuid,
          ${subjectId}::uuid,
          ${session.user.id}::uuid,
          ${title},
          ${description || null},
          ${scheduledStart}::timestamp,
          ${scheduledEnd}::timestamp,
          ${calendarData.eventId || null},
          ${calendarData.meetLink || null},
          ${calendarData.meetSpaceId || null},
          'scheduled'::lecture_status,
          NOW(),
          NOW()
        )
        RETURNING id::text AS id
      `;

      await createNotifications(
        tx,
        [enrollment.teacher_user_id, enrollment.student_user_id, enrollment.parent_user_id],
        "New lecture scheduled",
        `${title} is scheduled for ${enrollment.student_name}.`,
        "class"
      );

      await createAuditLog(
        {
          actorUserId: session.user.id,
          action: "lecture_scheduled",
          entityType: "lecture_schedules",
          entityId: rows[0].id,
          newData: {
            studentId,
            teacherId,
            subjectId,
            enrollmentId,
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
          ls.scheduled_start,
          ls.scheduled_end,
          ls.status::text AS status,
          ls.google_calendar_event_id,
          ls.google_meet_link,
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
        WHERE ls.id = ${rows[0].id}::uuid
      `;
    });

    return json("Lecture scheduled.", 201, { item: created });
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

