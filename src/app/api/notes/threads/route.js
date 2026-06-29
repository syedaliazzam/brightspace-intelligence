import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { requireRole, roleGuardResponse } from "@/lib/roleGuard";
import prisma from "@/lib/prisma";

const ALLOWED_ROLES = ["teacher", "admin", "student", "parent"];

function json(message, status = 200, extra = {}) {
  return NextResponse.json({ message, ...extra }, { status });
}

function clean(value) {
  return typeof value === "string" ? value.trim() : "";
}

async function getRoleContext(session) {
  const role = String(session.user.role || "").toLowerCase();

  if (role === "teacher") {
    const [teacher] = await prisma.$queryRaw`
      SELECT id::text AS id FROM teacher_profiles WHERE user_id = ${session.user.id}::uuid LIMIT 1
    `;
    return { role, teacherId: teacher?.id || null };
  }

  if (role === "student") {
    const [student] = await prisma.$queryRaw`
      SELECT id::text AS id FROM student_profiles WHERE user_id = ${session.user.id}::uuid LIMIT 1
    `;
    return { role, studentId: student?.id || null };
  }

  if (role === "parent") {
    const [parent] = await prisma.$queryRaw`
      SELECT id::text AS id FROM parent_profiles WHERE user_id = ${session.user.id}::uuid LIMIT 1
    `;
    return { role, parentId: parent?.id || null };
  }

  return { role };
}

async function getTeacherProfileId(session) {
  const [teacher] = await prisma.$queryRaw`
    SELECT id::text AS id FROM teacher_profiles WHERE user_id = ${session.user.id}::uuid LIMIT 1
  `;
  return teacher?.id || null;
}

async function resolveTeacherLecture(session, body) {
  const classLevel = clean(body?.classLevel || body?.class_level);
  const subjectId = clean(body?.subjectId || body?.subject_id);
  if (!classLevel || !subjectId) return null;

  const [lecture] = await prisma.$queryRaw`
    SELECT
      ls.id::text AS id,
      ls.teacher_id::text AS teacher_id,
      e.course_id::text AS course_id,
      c.class_level AS class_level,
      sub.id::text AS subject_id,
      sub.name AS subject_name
    FROM lecture_schedules ls
    INNER JOIN enrollments e ON e.id = ls.enrollment_id
    INNER JOIN courses c ON c.id = e.course_id
    INNER JOIN subjects sub ON sub.id = ls.subject_id
    INNER JOIN teacher_profiles tp ON tp.id = ls.teacher_id
    WHERE LOWER(COALESCE(c.class_level, c.title)) = LOWER(${classLevel})
      AND ls.subject_id = ${subjectId}::uuid
      AND tp.user_id = ${session.user.id}::uuid
    ORDER BY ls.scheduled_start DESC, ls.id DESC
    LIMIT 1
  `;
  return lecture || null;
}

export async function GET(request) {
  try {
    const session = await requireRole(ALLOWED_ROLES);
    const ctx = await getRoleContext(session);
    const { searchParams } = new URL(request.url);
    const threadId = clean(searchParams.get("threadId"));

    if (threadId) {
      const [thread] = await prisma.$queryRaw`
        SELECT
          nt.id::text AS id,
          nt.teacher_id::text AS teacher_id,
          nt.course_id::text AS course_id,
          nt.subject_id::text AS subject_id,
          nt.class_level,
          nt.visibility,
          nt.created_at,
          nt.updated_at,
          c.title AS course_title,
          sub.name AS subject_name,
          tu.full_name AS teacher_name,
          latest.message AS last_message,
          latest.sender_role AS last_sender_role,
          latest.created_at AS last_message_at
        FROM note_threads nt
        LEFT JOIN courses c ON c.id = nt.course_id
        LEFT JOIN subjects sub ON sub.id = nt.subject_id
        LEFT JOIN teacher_profiles tp ON tp.id = nt.teacher_id
        LEFT JOIN users tu ON tu.id = tp.user_id
        LEFT JOIN LATERAL (
          SELECT m.message, m.sender_role, m.created_at
          FROM note_thread_messages m
          WHERE m.thread_id = nt.id
          ORDER BY m.created_at DESC
          LIMIT 1
        ) latest ON TRUE
        WHERE nt.id = ${threadId}::uuid
        LIMIT 1
      `;
      if (!thread?.id) return json("Thread not found.", 404, { items: [], thread: null });

      const messages = await prisma.$queryRaw`
        SELECT
          m.id::text AS id,
          m.thread_id::text AS thread_id,
          m.sender_user_id::text AS sender_user_id,
          m.sender_role,
          m.message,
          m.created_at,
          u.full_name,
          u.username
        FROM note_thread_messages m
        INNER JOIN users u ON u.id = m.sender_user_id
        WHERE m.thread_id = ${threadId}::uuid
        ORDER BY m.created_at ASC
      `;
      return json("Thread fetched.", 200, { thread, items: messages });
    }

    let items = [];

    if (ctx.role === "admin") {
      items = await prisma.$queryRaw`
        SELECT
          nt.id::text AS id,
          nt.teacher_id::text AS teacher_id,
          nt.course_id::text AS course_id,
          nt.subject_id::text AS subject_id,
          nt.class_level,
          nt.visibility,
          nt.created_at,
          nt.updated_at,
          c.title AS course_title,
          sub.name AS subject_name,
          tu.full_name AS teacher_name,
          latest.message AS last_message,
          latest.sender_role AS last_sender_role,
          latest.created_at AS last_message_at,
          (
            SELECT COUNT(*)::int
            FROM note_thread_messages m
            WHERE m.thread_id = nt.id
          ) AS message_count
        FROM note_threads nt
        LEFT JOIN courses c ON c.id = nt.course_id
        LEFT JOIN subjects sub ON sub.id = nt.subject_id
        LEFT JOIN teacher_profiles tp ON tp.id = nt.teacher_id
        LEFT JOIN users tu ON tu.id = tp.user_id
        LEFT JOIN LATERAL (
          SELECT m.message, m.sender_role, m.created_at
          FROM note_thread_messages m
          WHERE m.thread_id = nt.id
          ORDER BY m.created_at DESC
          LIMIT 1
        ) latest ON TRUE
        ORDER BY nt.created_at DESC
      `;
      return json("Threads fetched.", 200, { items });
    }

    if (ctx.role === "teacher") {
      items = await prisma.$queryRaw`
        SELECT
          nt.id::text AS id,
          nt.teacher_id::text AS teacher_id,
          nt.course_id::text AS course_id,
          nt.subject_id::text AS subject_id,
          nt.class_level,
          nt.visibility,
          nt.created_at,
          nt.updated_at,
          c.title AS course_title,
          sub.name AS subject_name,
          tu.full_name AS teacher_name,
          latest.message AS last_message,
          latest.sender_role AS last_sender_role,
          latest.created_at AS last_message_at,
          (
            SELECT COUNT(*)::int
            FROM note_thread_messages m
            WHERE m.thread_id = nt.id
          ) AS message_count
        FROM note_threads nt
        INNER JOIN teacher_profiles tp ON tp.id = nt.teacher_id
        INNER JOIN users tu ON tu.id = tp.user_id
        LEFT JOIN courses c ON c.id = nt.course_id
        LEFT JOIN subjects sub ON sub.id = nt.subject_id
        LEFT JOIN LATERAL (
          SELECT m.message, m.sender_role, m.created_at
          FROM note_thread_messages m
          WHERE m.thread_id = nt.id
          ORDER BY m.created_at DESC
          LIMIT 1
        ) latest ON TRUE
        WHERE tp.user_id = ${session.user.id}::uuid
        ORDER BY nt.created_at DESC
      `;
      return json("Threads fetched.", 200, { items });
    }

    if (ctx.role === "student") {
      items = await prisma.$queryRaw`
        SELECT
          nt.id::text AS id,
          nt.teacher_id::text AS teacher_id,
          nt.course_id::text AS course_id,
          nt.subject_id::text AS subject_id,
          nt.class_level,
          nt.visibility,
          nt.created_at,
          nt.updated_at,
          c.title AS course_title,
          sub.name AS subject_name,
          tu.full_name AS teacher_name,
          latest.message AS last_message,
          latest.sender_role AS last_sender_role,
          latest.created_at AS last_message_at,
          (
            SELECT COUNT(*)::int
            FROM note_thread_messages m
            WHERE m.thread_id = nt.id
          ) AS message_count
        FROM note_threads nt
        LEFT JOIN courses c ON c.id = nt.course_id
        LEFT JOIN subjects sub ON sub.id = nt.subject_id
        LEFT JOIN teacher_profiles tp ON tp.id = nt.teacher_id
        LEFT JOIN users tu ON tu.id = tp.user_id
        LEFT JOIN LATERAL (
          SELECT m.message, m.sender_role, m.created_at
          FROM note_thread_messages m
          WHERE m.thread_id = nt.id
          ORDER BY m.created_at DESC
          LIMIT 1
        ) latest ON TRUE
        WHERE EXISTS (
          SELECT 1
          FROM enrollments e
          INNER JOIN student_profiles sp ON sp.id = e.student_id
          WHERE sp.user_id = ${session.user.id}::uuid
            AND e.course_id = nt.course_id
            AND LOWER(COALESCE(e.status::text, 'active')) = 'active'
        )
          AND LOWER(COALESCE(nt.visibility, 'student')) = 'student'
        ORDER BY nt.created_at DESC
      `;
      return json("Threads fetched.", 200, { items });
    }

    if (ctx.role === "parent") {
      items = await prisma.$queryRaw`
        SELECT
          nt.id::text AS id,
          nt.teacher_id::text AS teacher_id,
          nt.course_id::text AS course_id,
          nt.subject_id::text AS subject_id,
          nt.class_level,
          nt.visibility,
          nt.created_at,
          nt.updated_at,
          c.title AS course_title,
          sub.name AS subject_name,
          tu.full_name AS teacher_name,
          latest.message AS last_message,
          latest.sender_role AS last_sender_role,
          latest.created_at AS last_message_at,
          (
            SELECT COUNT(*)::int
            FROM note_thread_messages m
            WHERE m.thread_id = nt.id
          ) AS message_count
        FROM note_threads nt
        LEFT JOIN courses c ON c.id = nt.course_id
        LEFT JOIN subjects sub ON sub.id = nt.subject_id
        LEFT JOIN teacher_profiles tp ON tp.id = nt.teacher_id
        LEFT JOIN users tu ON tu.id = tp.user_id
        LEFT JOIN LATERAL (
          SELECT m.message, m.sender_role, m.created_at
          FROM note_thread_messages m
          WHERE m.thread_id = nt.id
          ORDER BY m.created_at DESC
          LIMIT 1
        ) latest ON TRUE
        WHERE EXISTS (
          SELECT 1
          FROM student_parents spp
          INNER JOIN student_profiles sp ON sp.id = spp.student_id
          INNER JOIN enrollments e ON e.student_id = sp.id
          WHERE spp.parent_id = (
            SELECT id FROM parent_profiles WHERE user_id = ${session.user.id}::uuid LIMIT 1
          )
            AND e.course_id = nt.course_id
            AND LOWER(COALESCE(e.status::text, 'active')) = 'active'
        )
          AND LOWER(COALESCE(nt.visibility, 'parent')) IN ('parent', 'student')
        ORDER BY nt.created_at DESC
      `;
      return json("Threads fetched.", 200, { items });
    }

    return json("Unsupported role.", 403);
  } catch (error) {
    const guard = roleGuardResponse(error);
    return guard || json(error instanceof Error ? error.message : "Unable to load threads.", 500);
  }
}

export async function POST(request) {
  try {
    const session = await requireRole(ALLOWED_ROLES);
    const ctx = await getRoleContext(session);
    const body = await request.json().catch(() => ({}));
    const bodyText = clean(body?.body || body?.message || body?.note);
    const classLevel = clean(body?.classLevel || body?.class_level);
    const subjectId = clean(body?.subjectId || body?.subject_id);
    const visibility = clean(body?.visibility).toLowerCase() || "parent";

    if (!bodyText) return json("Message is required.", 400);

    if (ctx.role === "teacher" || ctx.role === "admin") {
      const lecture = ctx.role === "teacher" ? await resolveTeacherLecture(session, body) : null;
      const teacherId = ctx.role === "teacher" ? lecture?.teacher_id : clean(body?.teacherId || body?.teacher_id);
      if (!teacherId) return json("Teacher profile not found.", 404);
      let courseId = clean(body?.courseId || body?.course_id) || lecture?.course_id || "";
      if (!courseId && classLevel) {
        const [course] = await prisma.$queryRaw`
          SELECT id::text AS id
          FROM courses
          WHERE LOWER(COALESCE(class_level, title)) = LOWER(${classLevel})
          ORDER BY id DESC
          LIMIT 1
        `;
        courseId = course?.id || "";
      }
      if (!courseId || !subjectId) return json("Class and subject are required.", 400);

      let [thread] = await prisma.$queryRaw`
        SELECT id::text AS id
        FROM note_threads
        WHERE teacher_id = ${teacherId}::uuid
          AND course_id = ${courseId}::uuid
          AND subject_id = ${subjectId}::uuid
          AND visibility = ${visibility}
        LIMIT 1
      `;
      if (!thread?.id) {
        [thread] = await prisma.$queryRaw`
          INSERT INTO note_threads (id, teacher_id, course_id, subject_id, class_level, visibility, created_at, updated_at)
          VALUES (gen_random_uuid(), ${teacherId}::uuid, ${courseId}::uuid, ${subjectId}::uuid, ${classLevel || null}, ${visibility}, NOW(), NOW())
          RETURNING id::text AS id
        `;
      }
      await prisma.$executeRaw`
        INSERT INTO note_thread_messages (id, thread_id, sender_user_id, sender_role, message, created_at, updated_at)
        VALUES (gen_random_uuid(), ${thread.id}::uuid, ${session.user.id}::uuid, ${ctx.role}, ${bodyText}, NOW(), NOW())
      `;
      return json("Thread created.", 201, { item: thread });
    }

    return json("Only staff can start a thread.", 403);
  } catch (error) {
    const guard = roleGuardResponse(error);
    return guard || json(error instanceof Error ? error.message : "Unable to create thread.", 500);
  }
}
