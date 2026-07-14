import { NextResponse } from "next/server";
import { requireRole, roleGuardResponse } from "@/lib/roleGuard";
import prisma from "@/lib/prisma";

const ALLOWED_ROLES = ["teacher", "admin", "superadmin", "student", "parent"];

function json(message, status = 200, extra = {}) {
  return NextResponse.json({ message, ...extra }, { status });
}

function clean(value) {
  return typeof value === "string" ? value.trim() : "";
}

async function canAccessThread(session, threadId) {
  const role = String(session.user.role || "").toLowerCase();

  if (role === "admin" || role === "superadmin") {
    return prisma.$queryRaw`
      SELECT nt.id::text AS id
      FROM note_threads nt
      WHERE nt.id = ${threadId}::uuid
      LIMIT 1
    `;
  }

  if (role === "teacher") {
    return prisma.$queryRaw`
      SELECT nt.id::text AS id
      FROM note_threads nt
      INNER JOIN teacher_profiles tp ON tp.id = nt.teacher_id
      WHERE nt.id = ${threadId}::uuid
        AND tp.user_id = ${session.user.id}::uuid
      LIMIT 1
    `;
  }

  if (role === "student") {
    return prisma.$queryRaw`
      SELECT nt.id::text AS id
      FROM note_threads nt
      WHERE nt.id = ${threadId}::uuid
        AND LOWER(COALESCE(nt.visibility, 'student')) = 'student'
        AND EXISTS (
          SELECT 1
          FROM enrollments e
          INNER JOIN student_profiles sp ON sp.id = e.student_id
          WHERE sp.user_id = ${session.user.id}::uuid
            AND e.course_id = nt.course_id
            AND LOWER(COALESCE(e.status::text, 'active')) = 'active'
        )
      LIMIT 1
    `;
  }

  return prisma.$queryRaw`
    SELECT nt.id::text AS id
    FROM note_threads nt
    WHERE nt.id = ${threadId}::uuid
      AND LOWER(COALESCE(nt.visibility, 'parent')) IN ('parent', 'student')
      AND EXISTS (
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
    LIMIT 1
  `;
}

export async function GET(request, { params }) {
  try {
    const session = await requireRole(ALLOWED_ROLES);
    const { id } = await params;
    const [thread] = await canAccessThread(session, id);
    if (!thread?.id) return json("Thread not found.", 404);

    const items = await prisma.$queryRaw`
      SELECT
        m.id::text AS id,
        m.thread_id::text AS thread_id,
        m.sender_user_id::text AS sender_user_id,
        m.sender_role,
        m.message,
        m.reply_to_message_id::text AS reply_to_message_id,
        m.created_at,
        u.full_name,
        u.username
      FROM note_thread_messages m
      INNER JOIN users u ON u.id = m.sender_user_id
      WHERE m.thread_id = ${id}::uuid
      ORDER BY m.created_at ASC
    `;
    return json("Messages fetched.", 200, { items });
  } catch (error) {
    const guard = roleGuardResponse(error);
    return guard || json(error instanceof Error ? error.message : "Unable to load messages.", 500);
  }
}

export async function POST(request, { params }) {
  try {
    const session = await requireRole(ALLOWED_ROLES);
    const { id } = await params;
    const [thread] = await canAccessThread(session, id);
    if (!thread?.id) return json("Thread not found.", 404);

    const body = await request.json().catch(() => ({}));
    const message = clean(body?.message || body?.body || body?.note);
    const replyToMessageId = clean(body?.replyToMessageId || body?.reply_to_message_id);
    if (!message) return json("Message is required.", 400);

    const [created] = await prisma.$queryRaw`
      INSERT INTO note_thread_messages (
        id,
        thread_id,
        sender_user_id,
        sender_role,
        message,
        reply_to_message_id,
        created_at,
        updated_at
      )
      VALUES (
        gen_random_uuid(),
        ${id}::uuid,
        ${session.user.id}::uuid,
        ${String(session.user.role || "").toLowerCase()},
        ${message},
        ${replyToMessageId || null}::uuid,
        NOW(),
        NOW()
      )
      RETURNING id::text AS id
    `;
    return json("Message added.", 201, { item: created });
  } catch (error) {
    const guard = roleGuardResponse(error);
    return guard || json(error instanceof Error ? error.message : "Unable to add message.", 500);
  }
}
