import crypto from "crypto";
import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { createAuditLog } from "@/lib/auditLog";
import { requireRole, roleGuardResponse } from "@/lib/roleGuard";

const ALLOWED_ROLES = ["admin", "coordinator"];

function json(message, status = 200, extra = {}) {
  return NextResponse.json({ message, ...extra }, { status });
}

function normalizeText(value) {
  return typeof value === "string" ? value.trim() : "";
}

async function getOptions() {
  const [teachers, students, courses, subjects] = await Promise.all([
    prisma.$queryRaw`
      SELECT tp.id::text AS id, u.full_name
      FROM teacher_profiles tp
      INNER JOIN users u ON u.id = tp.user_id
      WHERE u.status = 'active'
      ORDER BY u.full_name ASC
    `,
    prisma.$queryRaw`
      SELECT sp.id::text AS id, u.full_name
      FROM student_profiles sp
      INNER JOIN users u ON u.id = sp.user_id
      WHERE u.status = 'active'
      ORDER BY u.full_name ASC
    `,
    prisma.$queryRaw`
      SELECT id::text AS id, title
      FROM courses
      WHERE status = 'active'
      ORDER BY title ASC
    `,
    prisma.$queryRaw`
      SELECT id::text AS id, name
      FROM subjects
      WHERE status = 'active'
      ORDER BY name ASC
    `,
  ]);

  return { teachers, students, courses, subjects };
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
          tu.full_name ILIKE ${term}
          OR su.full_name ILIKE ${term}
          OR c.title ILIKE ${term}
          OR s.name ILIKE ${term}
        )`
      );
    }

    if (status) {
      conditions.push(Prisma.sql`LOWER(ta.status::text) = ${status}`);
    }

    const whereClause = conditions.length
      ? Prisma.sql`WHERE ${Prisma.join(conditions, Prisma.sql` AND `)}`
      : Prisma.empty;

    const [items, options] = await Promise.all([
      prisma.$queryRaw`
        SELECT
          ta.id::text AS id,
          ta.teacher_id::text AS teacher_id,
          ta.student_id::text AS student_id,
          ta.course_id::text AS course_id,
          ta.subject_id::text AS subject_id,
          ta.status::text AS status,
          tu.full_name AS teacher_name,
          su.full_name AS student_name,
          c.title AS course_title,
          s.name AS subject_name,
          ta.created_at
        FROM teacher_assignments ta
        INNER JOIN teacher_profiles tp ON tp.id = ta.teacher_id
        INNER JOIN users tu ON tu.id = tp.user_id
        LEFT JOIN student_profiles sp ON sp.id = ta.student_id
        LEFT JOIN users su ON su.id = sp.user_id
        LEFT JOIN courses c ON c.id = ta.course_id
        INNER JOIN subjects s ON s.id = ta.subject_id
        ${whereClause}
        ORDER BY ta.created_at DESC
      `,
      getOptions(),
    ]);

    return json("Teacher assignments fetched.", 200, { items, ...options });
  } catch (error) {
    const guard = roleGuardResponse(error);
    if (guard) {
      return guard;
    }

    return json(
      error instanceof Error ? error.message : "Unable to fetch teacher assignments.",
      500
    );
  }
}

export async function POST(request) {
  try {
    const session = await requireRole(ALLOWED_ROLES);
    const body = await request.json();
    const teacherId = normalizeText(body?.teacherId);
    const studentId = normalizeText(body?.studentId);
    const courseId = normalizeText(body?.courseId);
    const subjectId = normalizeText(body?.subjectId);

    if (!teacherId || !subjectId) {
      return json("Teacher and subject are required.", 400);
    }

    const [created] = await prisma.$transaction(async (tx) => {
      const rows = await tx.$queryRaw`
        INSERT INTO teacher_assignments (
          id,
          teacher_id,
          student_id,
          course_id,
          subject_id,
          assigned_by,
          status,
          created_at,
          updated_at
        )
        VALUES (
          ${crypto.randomUUID()}::uuid,
          ${teacherId}::uuid,
          ${studentId || null}::uuid,
          ${courseId || null}::uuid,
          ${subjectId}::uuid,
          ${session.user.id}::uuid,
          'active'::user_status,
          NOW(),
          NOW()
        )
        RETURNING id::text AS id
      `;

      await createAuditLog(
        {
          actorUserId: session.user.id,
          action: "teacher_assigned",
          entityType: "teacher_assignments",
          entityId: rows[0].id,
          newData: { teacherId, studentId, courseId, subjectId, status: "active" },
        },
        tx
      );

      return tx.$queryRaw`
        SELECT
          ta.id::text AS id,
          ta.teacher_id::text AS teacher_id,
          ta.student_id::text AS student_id,
          ta.course_id::text AS course_id,
          ta.subject_id::text AS subject_id,
          ta.status::text AS status,
          tu.full_name AS teacher_name,
          su.full_name AS student_name,
          c.title AS course_title,
          s.name AS subject_name,
          ta.created_at
        FROM teacher_assignments ta
        INNER JOIN teacher_profiles tp ON tp.id = ta.teacher_id
        INNER JOIN users tu ON tu.id = tp.user_id
        LEFT JOIN student_profiles sp ON sp.id = ta.student_id
        LEFT JOIN users su ON su.id = sp.user_id
        LEFT JOIN courses c ON c.id = ta.course_id
        INNER JOIN subjects s ON s.id = ta.subject_id
        WHERE ta.id = ${rows[0].id}::uuid
      `;
    });

    return json("Teacher assignment created.", 201, { item: created });
  } catch (error) {
    const guard = roleGuardResponse(error);
    if (guard) {
      return guard;
    }

    return json(
      error instanceof Error ? error.message : "Unable to create teacher assignment.",
      500
    );
  }
}

