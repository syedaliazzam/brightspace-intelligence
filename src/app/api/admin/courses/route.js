import crypto from "crypto";
import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";

function json(message, status = 200, extra = {}) {
  return NextResponse.json({ message, ...extra }, { status });
}

function normalizeText(value) {
  return typeof value === "string" ? value.trim() : "";
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

async function insertAuditLog(actorUserId, targetId, action, description, metadata = {}, tx = prisma) {
  const columns = await getTableColumns("audit_logs", tx);

  if (!Object.keys(columns).length) {
    return;
  }

  const insertColumns = [];
  const insertValues = [];

  const pushColumn = (name, value) => {
    if (columns[name]) {
      insertColumns.push(Prisma.raw(`"${name}"`));
      insertValues.push(getValueSql(columns[name], value));
    }
  };

  pushColumn("id", crypto.randomUUID());
  pushColumn("actor_user_id", actorUserId);
  pushColumn("entity_type", "courses");
  pushColumn("entity_id", targetId);
  pushColumn("action", action);
  pushColumn("description", description);
  pushColumn("metadata", JSON.stringify(metadata));
  pushColumn("meta", JSON.stringify(metadata));

  if (insertColumns.length) {
    await tx.$executeRaw(
      Prisma.sql`
        INSERT INTO audit_logs (${Prisma.join(insertColumns, ", ")})
        VALUES (${Prisma.join(insertValues, ", ")})
      `
    );
  }
}

export async function GET(request) {
  const authState = await requireAdminSession();

  if (authState.error) {
    return authState.error;
  }

  try {
    const coursesExists = await tableExists("courses");
    const subjectsExists = await tableExists("subjects");
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

    if (status && columns.status) {
      conditions.push(Prisma.sql`LOWER(c.status::text) = ${status}`);
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

    const items =
      subjectsExists && columns.subject_id
        ? await prisma.$queryRaw(
            Prisma.sql`
              SELECT
                c.id::text AS id,
                ${columns.name ? Prisma.sql`c.name,` : Prisma.sql`NULL AS name,`}
                ${columns.code ? Prisma.sql`c.code,` : Prisma.sql`NULL AS code,`}
                ${columns.description ? Prisma.sql`c.description,` : Prisma.sql`NULL AS description,`}
                ${columns.class_mode ? Prisma.sql`c.class_mode,` : Prisma.sql`NULL AS class_mode,`}
                ${columns.capacity ? Prisma.sql`c.capacity,` : Prisma.sql`NULL AS capacity,`}
                ${columns.subject_id ? Prisma.sql`c.subject_id::text AS subject_id,` : Prisma.sql`NULL AS subject_id,`}
                ${columns.status ? Prisma.sql`LOWER(c.status::text) AS status,` : Prisma.sql`'draft' AS status,`}
                s.name AS subject_name
              FROM courses c
              LEFT JOIN subjects s ON s.id = c.subject_id
              ${whereClause}
              ORDER BY ${columns.created_at ? Prisma.sql`c.created_at DESC NULLS LAST` : Prisma.sql`c.id DESC`}
            `
          )
        : await prisma.$queryRaw(
            Prisma.sql`
              SELECT
                c.id::text AS id,
                ${
                  columns.name
                    ? Prisma.sql`c.name,`
                    : columns.title
                      ? Prisma.sql`c.title AS name,`
                      : Prisma.sql`NULL AS name,`
                }
                ${columns.code ? Prisma.sql`c.code,` : Prisma.sql`NULL AS code,`}
                ${columns.description ? Prisma.sql`c.description,` : Prisma.sql`NULL AS description,`}
                ${
                  columns.class_mode
                    ? Prisma.sql`c.class_mode,`
                    : columns.class_level
                      ? Prisma.sql`c.class_level AS class_mode,`
                      : Prisma.sql`NULL AS class_mode,`
                }
                ${columns.capacity ? Prisma.sql`c.capacity,` : Prisma.sql`NULL AS capacity,`}
                ${columns.subject_id ? Prisma.sql`c.subject_id::text AS subject_id,` : Prisma.sql`NULL AS subject_id,`}
                ${columns.status ? Prisma.sql`LOWER(c.status::text) AS status,` : Prisma.sql`'draft' AS status,`}
                NULL AS subject_name
              FROM courses c
              ${whereClause}
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

    return json("Courses fetched.", 200, {
      available: true,
      items,
      subjects,
      schedules,
      summary: {
        total: items.length,
        active: items.filter((item) => item.status === "active").length,
        draft: items.filter((item) => item.status === "draft").length,
        schedules: schedules.length,
      },
    });
  } catch (error) {
    return json(
      error instanceof Error ? error.message : "Unable to fetch courses.",
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
    const name = normalizeText(body?.name);
    const code = normalizeText(body?.code);
    const subjectId = normalizeText(body?.subjectId);
    const description = normalizeText(body?.description);
    const classMode = normalizeText(body?.classMode);
    const capacity = body?.capacity === "" ? null : Number(body?.capacity);
    const status = normalizeText(body?.status).toLowerCase() || "draft";

    if (!name) {
      return json("Course name is required.", 400);
    }

    const columns = await getTableColumns("courses");
    const id = crypto.randomUUID();
    const insertColumns = [];
    const insertValues = [];

    if (columns.id) {
      addColumn(insertColumns, insertValues, columns, "id", id);
    }
    if (columns.name) {
      addColumn(insertColumns, insertValues, columns, "name", name);
    }
    if (columns.code) {
      addColumn(insertColumns, insertValues, columns, "code", code || null);
    }
    if (columns.subject_id) {
      addColumn(
        insertColumns,
        insertValues,
        columns,
        "subject_id",
        subjectId || null
      );
    }
    if (columns.description) {
      addColumn(
        insertColumns,
        insertValues,
        columns,
        "description",
        description || null
      );
    }
    if (columns.class_mode) {
      addColumn(
        insertColumns,
        insertValues,
        columns,
        "class_mode",
        classMode || null
      );
    }
    if (columns.capacity) {
      addColumn(
        insertColumns,
        insertValues,
        columns,
        "capacity",
        Number.isFinite(capacity) ? capacity : null
      );
    }
    if (columns.status) {
      addColumn(insertColumns, insertValues, columns, "status", status);
    }

    await prisma.$transaction(async (tx) => {
      await tx.$executeRaw(
        Prisma.sql`
          INSERT INTO courses (${Prisma.join(insertColumns, ", ")})
          VALUES (${Prisma.join(insertValues, ", ")})
        `
      );

      await insertAuditLog(
        authState.session.user.id,
        id,
        "course_created",
        `Course ${name} created by admin.`,
        { code, status },
        tx
      );
    });

    return json("Course created.", 201, {
      item: {
        id,
        name,
        code,
        subject_id: subjectId || null,
        description,
        class_mode: classMode,
        capacity,
        status,
      },
    });
  } catch (error) {
    return json(
      error instanceof Error ? error.message : "Unable to create course.",
      500
    );
  }
}
