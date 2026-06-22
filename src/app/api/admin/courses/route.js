import crypto from "crypto";
import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import {
  ALLOWED_CLASS_LEVELS,
  CLASS_SUBJECTS,
  normalizeClassLevel,
} from "@/lib/academicCatalog";

const CLASS_LEVELS = [...ALLOWED_CLASS_LEVELS];

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

function addColumn(columns, values, columnMap, name, value) {
  columns.push(Prisma.raw(`"${name}"`));
  values.push(getValueSql(columnMap[name], value));
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

export async function GET(request) {
  const authState = await requireAdminSession();

  if (authState.error) {
    return authState.error;
  }

  try {
    const coursesExists = await tableExists("courses");
    const subjectsExists = await tableExists("subjects");
    const courseSubjectsExists = await tableExists("course_subjects");
    const schedulesExists = await tableExists("lecture_schedules");

    if (!coursesExists) {
      return json("Courses table is not available yet.", 200, {
        available: false,
        items: [],
        subjects: [],
        schedules: [],
        summary: { total: 0, active: 0, draft: 0, schedules: 0 },
      });
    }

    const columns = await getTableColumns("courses");
    const { searchParams } = new URL(request.url);
    const search = normalizeText(searchParams.get("search"));
    const status = normalizeText(searchParams.get("status")).toLowerCase();
    const subjectId = normalizeText(searchParams.get("subjectId"));
    const conditions = [];

    if (columns.class_level) {
      conditions.push(Prisma.sql`c.class_level IN (${Prisma.join(CLASS_LEVELS)})`);
    } else if (columns.title) {
      conditions.push(Prisma.sql`c.title IN (${Prisma.join(CLASS_LEVELS)})`);
    }

    if (status && columns.status) {
      conditions.push(Prisma.sql`LOWER(c.status::text) = ${status}`);
    }

    if (subjectId && courseSubjectsExists) {
      conditions.push(Prisma.sql`
        EXISTS (
          SELECT 1
          FROM course_subjects cs_filter
          WHERE cs_filter.course_id = c.id
            AND cs_filter.subject_id = ${subjectId}::uuid
        )
      `);
    }

    if (search) {
      const term = `%${search}%`;
      const searchConditions = [];

      if (columns.name) {
        searchConditions.push(Prisma.sql`c.name ILIKE ${term}`);
      }
      if (columns.title) {
        searchConditions.push(Prisma.sql`c.title ILIKE ${term}`);
      }
      if (columns.code) {
        searchConditions.push(Prisma.sql`c.code ILIKE ${term}`);
      }
      if (columns.description) {
        searchConditions.push(Prisma.sql`c.description ILIKE ${term}`);
      }

      if (searchConditions.length) {
        conditions.push(
          Prisma.sql`(${Prisma.join(searchConditions, Prisma.sql` OR `)})`
        );
      }
    }

    const whereClause = conditions.length
      ? Prisma.sql`WHERE ${Prisma.join(conditions, Prisma.sql` AND `)}`
      : Prisma.empty;

    const items = await prisma.$queryRaw(
      Prisma.sql`
        SELECT
          c.id::text AS id,
          ${columns.title ? Prisma.sql`c.title AS name,` : Prisma.sql`NULL AS name,`}
          NULL AS code,
          ${columns.description ? Prisma.sql`c.description,` : Prisma.sql`NULL AS description,`}
          ${columns.class_level ? Prisma.sql`c.class_level AS class_mode,` : Prisma.sql`c.title AS class_mode,`}
          NULL AS capacity,
          NULL AS subject_id,
          ${columns.status ? Prisma.sql`LOWER(c.status::text) AS status,` : Prisma.sql`'pending' AS status,`}
          ${columns.created_at ? Prisma.sql`c.created_at::text AS created_at,` : Prisma.sql`NULL AS created_at,`}
          ${
            subjectsExists && courseSubjectsExists
              ? Prisma.sql`STRING_AGG(s.name, ', ' ORDER BY s.name) AS assigned_subjects`
              : Prisma.sql`NULL AS assigned_subjects`
          },
          NULL AS subject_name
        FROM courses c
        ${
          subjectsExists && courseSubjectsExists
            ? Prisma.sql`
                LEFT JOIN course_subjects cs ON cs.course_id = c.id
                LEFT JOIN subjects s ON s.id = cs.subject_id
              `
            : Prisma.empty
        }
        ${whereClause}
        GROUP BY c.id
        ORDER BY ${columns.created_at ? Prisma.sql`c.created_at DESC NULLS LAST` : Prisma.sql`c.id DESC`}
      `
    );

    const subjects =
      subjectsExists
        ? await prisma.$queryRaw`
            SELECT id::text AS id, name
            FROM subjects
            ORDER BY name ASC
          `
        : [];

    const schedules =
      schedulesExists
        ? await prisma.$queryRaw`
            SELECT
              id::text AS id,
              COALESCE(title, 'Lecture schedule') AS title,
              COALESCE(scheduled_start::text, '') AS schedule_time,
              COALESCE(status::text, 'scheduled') AS status
            FROM lecture_schedules
            ORDER BY created_at DESC NULLS LAST, id DESC
            LIMIT 8
          `
        : [];

    return json("Classes fetched.", 200, {
      available: true,
      items,
      subjects,
      schedules,
      summary: {
        total: items.length,
        active: items.filter((item) => item.status === "active").length,
        draft: items.filter((item) => item.status === "pending").length,
        schedules: schedules.length,
      },
    });
  } catch (error) {
    return json(
      error instanceof Error ? error.message : "Unable to fetch classes.",
      500
    );
  }
}

export async function POST(request) {
  const authState = await requireAdminSession();

  if (authState.error) {
    return authState.error;
  }

  try {
    if (!(await tableExists("courses"))) {
      return json("Courses table is not available yet.", 400);
    }

    const body = await request.json();
    const classLevel = normalizeClassLevel(body?.classMode || body?.name);
    const description = normalizeText(body?.description);
    const status = normalizeCourseStatus(body?.status);

    if (!classLevel) {
      return json("Please select a valid class level.", 400);
    }

    const [existing] = await prisma.$queryRaw`
      SELECT id::text
      FROM courses
      WHERE class_level = ${classLevel}
         OR title = ${classLevel}
      LIMIT 1
    `;

    if (existing?.id) {
      return json("This class already exists.", 409);
    }

    const id = crypto.randomUUID();

    await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`
        INSERT INTO courses (
          id,
          title,
          class_level,
          description,
          status
        )
        VALUES (
          ${id}::uuid,
          ${classLevel},
          ${classLevel},
          ${description || null},
          ${status}::user_status
        )
      `;

      await syncCourseSubjects(tx, id, classLevel);

      await insertAuditLog(
        authState.session.user.id,
        id,
        "course_created",
        `Class ${classLevel} created by admin.`,
        { status },
        tx
      );
    });

    return json("Class created.", 201, {
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
      error instanceof Error ? error.message : "Unable to create class.",
      500
    );
  }
}
