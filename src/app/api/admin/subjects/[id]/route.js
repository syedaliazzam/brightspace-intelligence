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
  pushColumn("entity_type", "subjects");
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

export async function PATCH(request, { params }) {
  const authState = await requireAdminSession();

  if (authState.error) {
    return authState.error;
  }

  try {
    if (!(await tableExists("subjects"))) {
      return json("Subjects table is not available yet.", 400);
    }

    const { id } = await params;
    const body = await request.json();
    const name = normalizeText(body?.name);
    const code = normalizeText(body?.code);
    const description = normalizeText(body?.description);
    const status = normalizeText(body?.status).toLowerCase();
    const columns = await getTableColumns("subjects");
    const updates = [];

    if (columns.name) {
      updates.push(Prisma.sql`name = ${name}`);
    }
    if (columns.code) {
      updates.push(Prisma.sql`code = ${code || null}`);
    }
    if (columns.description) {
      updates.push(Prisma.sql`description = ${description || null}`);
    }
    if (columns.status && status) {
      updates.push(Prisma.sql`status = ${status}`);
    }

    await prisma.$transaction(async (tx) => {
      if (updates.length) {
        await tx.$executeRaw(
          Prisma.sql`
            UPDATE subjects
            SET ${Prisma.join(updates, ", ")}
            WHERE id = ${id}::uuid
          `
        );
      }

      await insertAuditLog(
        authState.session.user.id,
        id,
        "subject_updated",
        `Subject ${name || id} updated by admin.`,
        { status },
        tx
      );
    });

    return json("Subject updated.", 200, {
      item: { id, name, code, description, status },
    });
  } catch (error) {
    return json(
      error instanceof Error ? error.message : "Unable to update subject.",
      500
    );
  }
}
