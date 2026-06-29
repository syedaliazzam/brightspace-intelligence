import crypto from "crypto";
import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { CLASS_SUBJECTS, normalizeClassLevel } from "@/lib/academicCatalog";

function json(message, status = 200, extra = {}) {
  return NextResponse.json({ message, ...extra }, { status });
}

function normalizeText(value) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeCourseStatus(value) {
  const status = normalizeText(value).toLowerCase();
  return ["active", "pending", "suspended", "archived"].includes(status)
    ? status
    : "active";
}

async function requireAdminSession() {
  const session = await auth();
  const role = String(session?.user?.role || "").toLowerCase();

  if (!session?.user) {
    return { error: json("Unauthorized.", 401) };
  }

  if (role !== "admin") {
    return { error: json("Forbidden.", 403) };
  }

  return { session };
}

async function tableExists(tableName) {
  const [row] = await prisma.$queryRaw`
    SELECT EXISTS (
      SELECT 1
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name = ${tableName}
    ) AS exists
  `;

  return Boolean(row?.exists);
}

async function getTableColumns(tableName, tx = prisma) {
  const rows = await tx.$queryRaw`
    SELECT
      column_name,
      data_type,
      udt_name
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = ${tableName}
  `;

  return rows.reduce((accumulator, row) => {
    accumulator[row.column_name] = {
      dataType: row.data_type,
      udtName: row.udt_name,
    };
    return accumulator;
  }, {});
}

function getValueSql(columnMeta, value) {
  if (!columnMeta || value === null || typeof value === "undefined") {
    return Prisma.sql`${value ?? null}`;
  }

  if (columnMeta.udtName === "uuid") {
    return Prisma.sql`${value}::uuid`;
  }

  if (columnMeta.dataType === "USER-DEFINED" && columnMeta.udtName) {
    return Prisma.sql`${value}::${Prisma.raw(columnMeta.udtName)}`;
  }

  return Prisma.sql`${value}`;
}

async function syncCourseSubjects(tx, courseId, classLevel) {
  const subjects = CLASS_SUBJECTS[classLevel] || [];

  if (!subjects.length) {
    return;
  }

  await tx.$executeRaw`
    DELETE FROM course_subjects
    WHERE course_id = ${courseId}::uuid
  `;

  await tx.$executeRaw(
    Prisma.sql`
      INSERT INTO course_subjects (course_id, subject_id)
      SELECT ${courseId}::uuid, s.id
      FROM subjects s
      WHERE s.name IN (${Prisma.join(subjects)})
      ON CONFLICT (course_id, subject_id) DO NOTHING
    `
  );
}

async function insertAuditLog(actorUserId, targetId, action, description, metadata = {}, tx = prisma) {
  await tx.$executeRaw`
    INSERT INTO audit_logs (id, actor_user_id, entity_type, entity_id, action)
    VALUES (
      ${crypto.randomUUID()}::uuid,
      ${actorUserId}::uuid,
      ${"courses"},
      ${targetId}::uuid,
      ${action}
    )
  `;
}

export async function PATCH(request, { params }) {
  const authState = await requireAdminSession();

  if (authState.error) {
    return authState.error;
  }

  try {
    if (!(await tableExists("courses"))) {
      return json("Courses table is not available yet.", 400);
    }

    const { id } = await params;
    const body = await request.json();
    const classLevel =
      normalizeClassLevel(body?.classMode || body?.name) ||
      normalizeText(body?.classMode || body?.name);
    const description = normalizeText(body?.description);
    const status = normalizeCourseStatus(body?.status);
    const updates = [];

    if (!classLevel) {
      return json("Class name is required.", 400);
    }

    const [existing] = await prisma.$queryRaw`
      SELECT id::text
      FROM courses
      WHERE (class_level = ${classLevel} OR title = ${classLevel})
        AND id <> ${id}::uuid
      LIMIT 1
    `;

    if (existing?.id) {
      return json("This class already exists.", 409);
    }

    updates.push(Prisma.sql`title = ${classLevel}`);
    updates.push(Prisma.sql`class_level = ${classLevel}`);

    if (description || body?.description === "") {
      updates.push(Prisma.sql`description = ${description || null}`);
    }
    if (status) {
      updates.push(Prisma.sql`status = ${status}::user_status`);
    }

    await prisma.$transaction(async (tx) => {
      if (updates.length) {
        await tx.$executeRaw(
          Prisma.sql`
            UPDATE courses
            SET ${Prisma.join(updates, Prisma.sql`, `)}
            WHERE id = ${id}::uuid
          `
        );
      }

      await syncCourseSubjects(tx, id, classLevel);

      await insertAuditLog(
        authState.session.user.id,
        id,
        "course_updated",
        `Class ${classLevel} updated by admin.`,
        { status },
        tx
      );
    });

    return json("Class updated.", 200, {
      item: {
        id,
        name: classLevel,
        code: null,
        subject_id: null,
        description,
        class_mode: classLevel,
        capacity: null,
        assigned_subjects: (CLASS_SUBJECTS[classLevel] || []).join(", "),
        status,
      },
    });
  } catch (error) {
    return json(
      error instanceof Error ? error.message : "Unable to update class.",
      500
    );
  }
}
