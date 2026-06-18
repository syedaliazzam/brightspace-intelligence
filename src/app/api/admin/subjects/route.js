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
      is_nullable,
      column_default,
      data_type,
      udt_name
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = ${tableName}
  `;

  return rows.reduce((accumulator, row) => {
    accumulator[row.column_name] = {
      nullable: row.is_nullable === "YES",
      defaultValue: row.column_default,
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
  const supportedColumns = new Set();

  if (columns.id) {
    addColumn(insertColumns, insertValues, columns, "id", crypto.randomUUID());
    supportedColumns.add("id");
  }
  if (columns.actor_user_id) {
    addColumn(insertColumns, insertValues, columns, "actor_user_id", actorUserId);
    supportedColumns.add("actor_user_id");
  }
  if (columns.entity_type) {
    addColumn(insertColumns, insertValues, columns, "entity_type", "subjects");
    supportedColumns.add("entity_type");
  }
  if (columns.entity_id) {
    addColumn(insertColumns, insertValues, columns, "entity_id", targetId);
    supportedColumns.add("entity_id");
  }
  if (columns.action) {
    addColumn(insertColumns, insertValues, columns, "action", action);
    supportedColumns.add("action");
  }
  if (columns.description) {
    addColumn(insertColumns, insertValues, columns, "description", description);
    supportedColumns.add("description");
  }
  if (columns.metadata) {
    addColumn(insertColumns, insertValues, columns, "metadata", JSON.stringify(metadata));
    supportedColumns.add("metadata");
  }
  if (columns.meta) {
    addColumn(insertColumns, insertValues, columns, "meta", JSON.stringify(metadata));
    supportedColumns.add("meta");
  }

  await tx.$executeRaw(
    Prisma.sql`
      INSERT INTO audit_logs (${Prisma.join(insertColumns, ", ")})
      VALUES (${Prisma.join(insertValues, ", ")})
    `
  );
}

export async function GET(request) {
  const authState = await requireAdminSession();

  if (authState.error) {
    return authState.error;
  }

  try {
    if (!(await tableExists("subjects"))) {
      return json("Subjects table is not available yet.", 200, {
        available: false,
        items: [],
        summary: { total: 0, active: 0, inactive: 0 },
      });
    }

    const columns = await getTableColumns("subjects");
    const { searchParams } = new URL(request.url);
    const search = normalizeText(searchParams.get("search"));
    const status = normalizeText(searchParams.get("status")).toLowerCase();
    const conditions = [];

    if (status && columns.status) {
      conditions.push(Prisma.sql`LOWER(status::text) = ${status}`);
    }

    if (search) {
      const term = `%${search}%`;
      const searchConditions = [];

      if (columns.name) {
        searchConditions.push(Prisma.sql`name ILIKE ${term}`);
      }
      if (columns.code) {
        searchConditions.push(Prisma.sql`code ILIKE ${term}`);
      }
      if (columns.description) {
        searchConditions.push(Prisma.sql`description ILIKE ${term}`);
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
          id::text AS id,
          ${columns.name ? Prisma.sql`name,` : Prisma.sql`NULL AS name,`}
          ${columns.code ? Prisma.sql`code,` : Prisma.sql`NULL AS code,`}
          ${columns.description ? Prisma.sql`description,` : Prisma.sql`NULL AS description,`}
          ${columns.status ? Prisma.sql`LOWER(status::text) AS status` : Prisma.sql`'active' AS status`}
        FROM subjects
        ${whereClause}
        ORDER BY ${columns.created_at ? Prisma.sql`created_at DESC NULLS LAST` : Prisma.sql`id DESC`}
      `
    );

    return json("Subjects fetched.", 200, {
      available: true,
      items,
      summary: {
        total: items.length,
        active: items.filter((item) => item.status === "active").length,
        inactive: items.filter((item) => item.status === "inactive").length,
      },
    });
  } catch (error) {
    return json(
      error instanceof Error ? error.message : "Unable to fetch subjects.",
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
    if (!(await tableExists("subjects"))) {
      return json("Subjects table is not available yet.", 400);
    }

    const body = await request.json();
    const name = normalizeText(body?.name);
    const code = normalizeText(body?.code);
    const description = normalizeText(body?.description);
    const status = normalizeText(body?.status).toLowerCase() || "active";

    if (!name) {
      return json("Subject name is required.", 400);
    }

    const columns = await getTableColumns("subjects");
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
    if (columns.description) {
      addColumn(
        insertColumns,
        insertValues,
        columns,
        "description",
        description || null
      );
    }
    if (columns.status) {
      addColumn(insertColumns, insertValues, columns, "status", status);
    }

    await prisma.$transaction(async (tx) => {
      await tx.$executeRaw(
        Prisma.sql`
          INSERT INTO subjects (${Prisma.join(insertColumns, ", ")})
          VALUES (${Prisma.join(insertValues, ", ")})
        `
      );

      await insertAuditLog(
        authState.session.user.id,
        id,
        "subject_created",
        `Subject ${name} created by admin.`,
        { code, status },
        tx
      );
    });

    return json("Subject created.", 201, {
      item: { id, name, code, description, status },
    });
  } catch (error) {
    return json(
      error instanceof Error ? error.message : "Unable to create subject.",
      500
    );
  }
}
