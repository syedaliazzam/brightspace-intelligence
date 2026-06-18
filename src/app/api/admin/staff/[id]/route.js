import crypto from "crypto";
import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";

const EDITABLE_ROLES = new Set(["coordinator", "teacher"]);

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

async function tableExists(tableName, tx = prisma) {
  const [row] = await tx.$queryRaw`
    SELECT EXISTS (
      SELECT 1
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name = ${tableName}
    ) AS exists
  `;

  return Boolean(row?.exists);
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

  if (columnMeta.dataType === "json" || columnMeta.dataType === "jsonb") {
    return Prisma.sql`${value}::${Prisma.raw(columnMeta.dataType)}`;
  }

  return Prisma.sql`${value}`;
}

function addColumn(columns, values, columnMap, name, value) {
  columns.push(Prisma.raw(`"${name}"`));
  values.push(getValueSql(columnMap[name], value));
}

function splitName(fullName) {
  const parts = normalizeText(fullName).split(/\s+/).filter(Boolean);
  return {
    firstName: parts[0] || "",
    lastName: parts.slice(1).join(" "),
  };
}

async function getRoleId(roleName, tx = prisma) {
  const [row] = await tx.$queryRaw`
    SELECT id::text AS id
    FROM roles
    WHERE LOWER(name) = ${roleName}
    LIMIT 1
  `;

  if (!row?.id) {
    throw new Error(`Role not found: ${roleName}`);
  }

  return row.id;
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
  if (columns.target_user_id) {
    addColumn(insertColumns, insertValues, columns, "target_user_id", targetId);
    supportedColumns.add("target_user_id");
  }
  if (columns.entity_type) {
    addColumn(insertColumns, insertValues, columns, "entity_type", "users");
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

async function syncProfile(tableName, payload, tx) {
  const columns = await getTableColumns(tableName, tx);

  if (!Object.keys(columns).length) {
    return;
  }

  const [existing] = await tx.$queryRaw(
    Prisma.sql`
      SELECT id::text AS id
      FROM ${Prisma.raw(`"${tableName}"`)}
      WHERE user_id = ${payload.userId}::uuid
      LIMIT 1
    `
  );

  const { firstName, lastName } = splitName(payload.fullName);

  if (existing?.id) {
    const updates = [];

    if (columns.full_name) {
      updates.push(Prisma.sql`full_name = ${payload.fullName}`);
    }
    if (columns.name) {
      updates.push(Prisma.sql`name = ${payload.fullName}`);
    }
    if (columns.first_name) {
      updates.push(Prisma.sql`first_name = ${firstName}`);
    }
    if (columns.last_name) {
      updates.push(Prisma.sql`last_name = ${lastName}`);
    }
    if (columns.email) {
      updates.push(Prisma.sql`email = ${payload.email || null}`);
    }
    if (columns.phone) {
      updates.push(Prisma.sql`phone = ${payload.phone || null}`);
    }
    if (columns.status) {
      updates.push(Prisma.sql`status = ${payload.status}`);
    }

    if (updates.length) {
      await tx.$executeRaw(
        Prisma.sql`
          UPDATE ${Prisma.raw(`"${tableName}"`)}
          SET ${Prisma.join(updates, ", ")}
          WHERE user_id = ${payload.userId}::uuid
        `
      );
    }

    return;
  }

  const insertColumns = [];
  const insertValues = [];
  const supportedColumns = new Set();

  if (columns.id) {
    addColumn(insertColumns, insertValues, columns, "id", crypto.randomUUID());
    supportedColumns.add("id");
  }
  if (columns.user_id) {
    addColumn(insertColumns, insertValues, columns, "user_id", payload.userId);
    supportedColumns.add("user_id");
  }
  if (columns.full_name) {
    addColumn(insertColumns, insertValues, columns, "full_name", payload.fullName);
    supportedColumns.add("full_name");
  }
  if (columns.name) {
    addColumn(insertColumns, insertValues, columns, "name", payload.fullName);
    supportedColumns.add("name");
  }
  if (columns.first_name) {
    addColumn(insertColumns, insertValues, columns, "first_name", firstName);
    supportedColumns.add("first_name");
  }
  if (columns.last_name) {
    addColumn(insertColumns, insertValues, columns, "last_name", lastName);
    supportedColumns.add("last_name");
  }
  if (columns.email) {
    addColumn(insertColumns, insertValues, columns, "email", payload.email || null);
    supportedColumns.add("email");
  }
  if (columns.phone) {
    addColumn(insertColumns, insertValues, columns, "phone", payload.phone || null);
    supportedColumns.add("phone");
  }
  if (columns.status) {
    addColumn(insertColumns, insertValues, columns, "status", payload.status);
    supportedColumns.add("status");
  }

  await tx.$executeRaw(
    Prisma.sql`
      INSERT INTO ${Prisma.raw(`"${tableName}"`)} (${Prisma.join(insertColumns, ", ")})
      VALUES (${Prisma.join(insertValues, ", ")})
    `
  );
}

async function getUserById(id, tx = prisma) {
  const [row] = await tx.$queryRaw`
    SELECT
      u.id::text AS id,
      COALESCE(NULLIF(u.full_name, ''), NULLIF(u.email, ''), NULLIF(u.phone, ''), 'User') AS name,
      u.email,
      u.phone,
      LOWER(u.status::text) AS status,
      LOWER(r.name) AS role
    FROM users u
    INNER JOIN roles r ON r.id = u.role_id
    WHERE u.id = ${id}
    LIMIT 1
  `;

  return row;
}

export async function GET(_request, { params }) {
  const authState = await requireAdminSession();

  if (authState.error) {
    return authState.error;
  }

  try {
    const { id } = await params;
    const item = await getUserById(id);

    if (!item?.id) {
      return json("Staff record not found.", 404);
    }

    return json("Staff record fetched.", 200, {
      item: {
        ...item,
        editable: EDITABLE_ROLES.has(item.role),
      },
    });
  } catch (error) {
    return json(
      error instanceof Error ? error.message : "Unable to fetch staff record.",
      500
    );
  }
}

export async function PATCH(request, { params }) {
  const authState = await requireAdminSession();

  if (authState.error) {
    return authState.error;
  }

  try {
    const { id } = await params;
    const existing = await getUserById(id);

    if (!existing?.id) {
      return json("Staff record not found.", 404);
    }

    if (!EDITABLE_ROLES.has(existing.role)) {
      return json("Only coordinator and teacher records can be updated here.", 400);
    }

    const body = await request.json();
    const fullName = normalizeText(body?.fullName) || existing.name;
    const email = normalizeText(body?.email).toLowerCase();
    const phone = normalizeText(body?.phone);
    const nextRole = normalizeText(body?.role).toLowerCase() || existing.role;
    const nextStatus = normalizeText(body?.status).toLowerCase() || existing.status;

    if (!EDITABLE_ROLES.has(nextRole)) {
      return json("Only coordinator and teacher roles are supported here.", 400);
    }

    if (!["active", "suspended"].includes(nextStatus)) {
      return json("Invalid staff status.", 400);
    }

    const roleId = await getRoleId(nextRole);
    const userColumns = await getTableColumns("users");
    const updates = [];
    const { firstName, lastName } = splitName(fullName);

    if (userColumns.full_name) {
      updates.push(Prisma.sql`full_name = ${fullName}`);
    }
    if (userColumns.name) {
      updates.push(Prisma.sql`name = ${fullName}`);
    }
    if (userColumns.first_name) {
      updates.push(Prisma.sql`first_name = ${firstName}`);
    }
    if (userColumns.last_name) {
      updates.push(Prisma.sql`last_name = ${lastName}`);
    }
    if (userColumns.email) {
      updates.push(Prisma.sql`email = ${email || null}`);
    }
    if (userColumns.phone) {
      updates.push(Prisma.sql`phone = ${phone || null}`);
    }
    if (userColumns.role_id) {
      updates.push(Prisma.sql`role_id = ${roleId}::uuid`);
    }
    if (userColumns.status) {
      updates.push(Prisma.sql`status = ${nextStatus}`);
    }

    await prisma.$transaction(async (tx) => {
      if (updates.length) {
        await tx.$executeRaw(
          Prisma.sql`
            UPDATE users
            SET ${Prisma.join(updates, ", ")}
            WHERE id = ${id}::uuid
          `
        );
      }

      const targetProfileTable =
        nextRole === "coordinator" ? "coordinator_profiles" : "teacher_profiles";

      if (await tableExists(targetProfileTable, tx)) {
        await syncProfile(
          targetProfileTable,
          { userId: id, fullName, email, phone, status: nextStatus },
          tx
        );
      }

      await insertAuditLog(
        authState.session.user.id,
        id,
        nextStatus === "suspended" ? "user_suspended" : "user_updated",
        `Staff record updated by admin.`,
        {
          previousRole: existing.role,
          nextRole,
          status: nextStatus,
        },
        tx
      );
    });

    const updated = await getUserById(id);
    return json("Staff record updated.", 200, {
      item: {
        ...updated,
        editable: EDITABLE_ROLES.has(updated.role),
      },
    });
  } catch (error) {
    return json(
      error instanceof Error ? error.message : "Unable to update staff record.",
      500
    );
  }
}
