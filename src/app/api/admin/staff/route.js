import crypto from "crypto";
import bcrypt from "bcrypt";
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

function ensureSupportedRequiredColumns(tableName, columns, supportedColumns) {
  const missing = Object.entries(columns)
    .filter(
      ([columnName, meta]) =>
        !meta.nullable && !meta.defaultValue && !supportedColumns.has(columnName)
    )
    .map(([columnName]) => columnName);

  if (missing.length) {
    throw new Error(
      `${tableName} requires unsupported columns: ${missing.join(", ")}.`
    );
  }
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

async function ensureUniqueUser(email, phone) {
  const conditions = [];

  if (email) {
    conditions.push(Prisma.sql`LOWER(email) = ${email.toLowerCase()}`);
  }

  if (phone) {
    conditions.push(Prisma.sql`phone = ${phone}`);
  }

  if (!conditions.length) {
    return;
  }

  const [row] = await prisma.$queryRaw(
    Prisma.sql`
      SELECT id::text AS id
      FROM users
      WHERE ${Prisma.join(conditions, Prisma.sql` OR `)}
      LIMIT 1
    `
  );

  if (row?.id) {
    throw new Error("A user with this email or phone already exists.");
  }
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

  ensureSupportedRequiredColumns("audit_logs", columns, supportedColumns);

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
      updates.push(Prisma.sql`status = ${payload.status || "active"}`);
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
    addColumn(insertColumns, insertValues, columns, "status", payload.status || "active");
    supportedColumns.add("status");
  }

  ensureSupportedRequiredColumns(tableName, columns, supportedColumns);

  await tx.$executeRaw(
    Prisma.sql`
      INSERT INTO ${Prisma.raw(`"${tableName}"`)} (${Prisma.join(insertColumns, ", ")})
      VALUES (${Prisma.join(insertValues, ", ")})
    `
  );
}

function getDisplayNameSql(userColumns) {
  if (userColumns.full_name) {
    return Prisma.sql`COALESCE(NULLIF(u.full_name, ''), NULLIF(u.email, ''), NULLIF(u.phone, ''), 'User')`;
  }

  if (userColumns.name) {
    return Prisma.sql`COALESCE(NULLIF(u.name, ''), NULLIF(u.email, ''), NULLIF(u.phone, ''), 'User')`;
  }

  if (userColumns.first_name && userColumns.last_name) {
    return Prisma.sql`COALESCE(NULLIF(CONCAT_WS(' ', u.first_name, u.last_name), ''), NULLIF(u.email, ''), NULLIF(u.phone, ''), 'User')`;
  }

  return Prisma.sql`COALESCE(NULLIF(u.email, ''), NULLIF(u.phone, ''), 'User')`;
}

export async function GET(request) {
  const authState = await requireAdminSession();

  if (authState.error) {
    return authState.error;
  }

  try {
    const userColumns = await getTableColumns("users");
    const displayNameSql = getDisplayNameSql(userColumns);
    const { searchParams } = new URL(request.url);
    const search = normalizeText(searchParams.get("search"));
    const role = normalizeText(searchParams.get("role")).toLowerCase();
    const status = normalizeText(searchParams.get("status")).toLowerCase();
    const conditions = [];

    if (role) {
      conditions.push(Prisma.sql`LOWER(r.name) = ${role}`);
    }

    if (status) {
      conditions.push(Prisma.sql`LOWER(u.status::text) = ${status}`);
    }

    if (search) {
      const term = `%${search}%`;
      const searchConditions = [
        Prisma.sql`u.email ILIKE ${term}`,
        Prisma.sql`u.phone ILIKE ${term}`,
      ];

      if (userColumns.full_name) {
        searchConditions.push(Prisma.sql`u.full_name ILIKE ${term}`);
      } else if (userColumns.name) {
        searchConditions.push(Prisma.sql`u.name ILIKE ${term}`);
      } else if (userColumns.first_name && userColumns.last_name) {
        searchConditions.push(
          Prisma.sql`CONCAT_WS(' ', u.first_name, u.last_name) ILIKE ${term}`
        );
      }

      conditions.push(
        Prisma.sql`(${Prisma.join(searchConditions, Prisma.sql` OR `)})`
      );
    }

    const whereClause = conditions.length
      ? Prisma.sql`WHERE ${Prisma.join(conditions, Prisma.sql` AND `)}`
      : Prisma.empty;

    const items = await prisma.$queryRaw`
      SELECT
        u.id::text AS id,
        ${displayNameSql} AS name,
        u.email,
        u.phone,
        LOWER(u.status::text) AS status,
        LOWER(r.name) AS role
      FROM users u
      INNER JOIN roles r ON r.id = u.role_id
      ${whereClause}
      ORDER BY u.created_at DESC NULLS LAST, u.id DESC
    `;

    const summaryRows = await prisma.$queryRaw`
      SELECT
        LOWER(r.name) AS role,
        COUNT(*)::int AS total
      FROM users u
      INNER JOIN roles r ON r.id = u.role_id
      GROUP BY LOWER(r.name)
    `;

    return json("Staff records fetched.", 200, {
      items: items.map((item) => ({
        ...item,
        editable: EDITABLE_ROLES.has(item.role),
      })),
      summary: {
        totalUsers: items.length,
        coordinators: Number(
          summaryRows.find((item) => item.role === "coordinator")?.total || 0
        ),
        teachers: Number(
          summaryRows.find((item) => item.role === "teacher")?.total || 0
        ),
        active: items.filter((item) => item.status === "active").length,
        suspended: items.filter((item) => item.status === "suspended").length,
      },
    });
  } catch (error) {
    return json(
      error instanceof Error ? error.message : "Unable to fetch staff records.",
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
    const body = await request.json();
    const fullName = normalizeText(body?.fullName);
    const email = normalizeText(body?.email).toLowerCase();
    const phone = normalizeText(body?.phone);
    const role = normalizeText(body?.role).toLowerCase();
    const password =
      typeof body?.password === "string" ? body.password.trim() : "";

    if (!EDITABLE_ROLES.has(role)) {
      return json("Only coordinator and teacher can be created here.", 400);
    }

    if (!fullName) {
      return json("Full name is required.", 400);
    }

    if (!email && !phone) {
      return json("Email or phone is required.", 400);
    }

    if (password.length < 8) {
      return json("Password must be at least 8 characters.", 400);
    }

    await ensureUniqueUser(email, phone);

    const roleId = await getRoleId(role);
    const hashedPassword = await bcrypt.hash(password, 12);
    const userId = crypto.randomUUID();
    const userColumns = await getTableColumns("users");
    const insertColumns = [];
    const insertValues = [];
    const supportedColumns = new Set();
    const { firstName, lastName } = splitName(fullName);

    if (userColumns.id) {
      addColumn(insertColumns, insertValues, userColumns, "id", userId);
      supportedColumns.add("id");
    }
    if (userColumns.role_id) {
      addColumn(insertColumns, insertValues, userColumns, "role_id", roleId);
      supportedColumns.add("role_id");
    }
    if (userColumns.full_name) {
      addColumn(insertColumns, insertValues, userColumns, "full_name", fullName);
      supportedColumns.add("full_name");
    }
    if (userColumns.name) {
      addColumn(insertColumns, insertValues, userColumns, "name", fullName);
      supportedColumns.add("name");
    }
    if (userColumns.first_name) {
      addColumn(insertColumns, insertValues, userColumns, "first_name", firstName);
      supportedColumns.add("first_name");
    }
    if (userColumns.last_name) {
      addColumn(insertColumns, insertValues, userColumns, "last_name", lastName);
      supportedColumns.add("last_name");
    }
    if (userColumns.email) {
      addColumn(insertColumns, insertValues, userColumns, "email", email || null);
      supportedColumns.add("email");
    }
    if (userColumns.phone) {
      addColumn(insertColumns, insertValues, userColumns, "phone", phone || null);
      supportedColumns.add("phone");
    }
    if (userColumns.password_hash) {
      addColumn(
        insertColumns,
        insertValues,
        userColumns,
        "password_hash",
        hashedPassword
      );
      supportedColumns.add("password_hash");
    }
    if (userColumns.status) {
      addColumn(insertColumns, insertValues, userColumns, "status", "active");
      supportedColumns.add("status");
    }
    if (userColumns.must_change_password) {
      addColumn(
        insertColumns,
        insertValues,
        userColumns,
        "must_change_password",
        true
      );
      supportedColumns.add("must_change_password");
    }

    ensureSupportedRequiredColumns("users", userColumns, supportedColumns);

    await prisma.$transaction(async (tx) => {
      await tx.$executeRaw(
        Prisma.sql`
          INSERT INTO users (${Prisma.join(insertColumns, ", ")})
          VALUES (${Prisma.join(insertValues, ", ")})
        `
      );

      await syncProfile(
        role === "coordinator" ? "coordinator_profiles" : "teacher_profiles",
        {
          userId,
          fullName,
          email,
          phone,
          status: "active",
        },
        tx
      );

      await insertAuditLog(
        authState.session.user.id,
        userId,
        "user_created",
        `${role} account created by admin.`,
        { role },
        tx
      );
    });

    return json("Staff user created.", 201, {
      item: {
        id: userId,
        name: fullName,
        email,
        phone,
        role,
        status: "active",
        editable: true,
      },
    });
  } catch (error) {
    return json(
      error instanceof Error ? error.message : "Unable to create staff user.",
      500
    );
  }
}
