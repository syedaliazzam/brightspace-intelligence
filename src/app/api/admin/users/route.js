import crypto from "crypto";
import bcrypt from "bcrypt";
import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";

const ALLOWED_CREATE_ROLES = new Set(["coordinator", "teacher"]);
const ALLOWED_FILTER_ROLES = new Set([
  "admin",
  "coordinator",
  "teacher",
  "parent",
  "student",
]);
const ALLOWED_FILTER_STATUSES = new Set(["active", "suspended", "inactive"]);

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

async function getTableColumns(tableName) {
  const rows = await prisma.$queryRaw`
    SELECT
      column_name,
      is_nullable,
      column_default
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = ${tableName}
  `;

  return rows.reduce((accumulator, row) => {
    accumulator[row.column_name] = {
      nullable: row.is_nullable === "YES",
      defaultValue: row.column_default,
    };
    return accumulator;
  }, {});
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

  if (userColumns.first_name) {
    return Prisma.sql`COALESCE(NULLIF(u.first_name, ''), NULLIF(u.email, ''), NULLIF(u.phone, ''), 'User')`;
  }

  return Prisma.sql`COALESCE(NULLIF(u.email, ''), NULLIF(u.phone, ''), 'User')`;
}

function getSearchConditions(search, userColumns) {
  if (!search) {
    return [];
  }

  const term = `%${search}%`;
  const conditions = [
    Prisma.sql`u.email ILIKE ${term}`,
    Prisma.sql`u.phone ILIKE ${term}`,
  ];

  if (userColumns.full_name) {
    conditions.push(Prisma.sql`u.full_name ILIKE ${term}`);
  } else if (userColumns.name) {
    conditions.push(Prisma.sql`u.name ILIKE ${term}`);
  } else if (userColumns.first_name && userColumns.last_name) {
    conditions.push(Prisma.sql`CONCAT_WS(' ', u.first_name, u.last_name) ILIKE ${term}`);
  } else if (userColumns.first_name) {
    conditions.push(Prisma.sql`u.first_name ILIKE ${term}`);
  }

  return [Prisma.sql`(${Prisma.join(conditions, ' OR ')})`];
}

async function getUsers(search, role, status) {
  const userColumns = await getTableColumns("users");
  const displayNameSql = getDisplayNameSql(userColumns);
  const conditions = [];

  if (role && ALLOWED_FILTER_ROLES.has(role)) {
    conditions.push(Prisma.sql`LOWER(r.name) = ${role}`);
  }

  if (status && ALLOWED_FILTER_STATUSES.has(status)) {
    conditions.push(Prisma.sql`LOWER(u.status::text) = ${status}`);
  }

  conditions.push(...getSearchConditions(search, userColumns));

  const whereClause = conditions.length
    ? Prisma.sql`WHERE ${Prisma.join(conditions, ' AND ')}`
    : Prisma.empty;

  const orderClause = userColumns.created_at
    ? Prisma.sql`ORDER BY u.created_at DESC NULLS LAST, u.id DESC`
    : Prisma.sql`ORDER BY u.id DESC`;

  return prisma.$queryRaw`
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
    ${orderClause}
  `;
}

function addColumn(columns, values, name, value) {
  columns.push(Prisma.raw(`"${name}"`));
  
  if (name === "id" || name.endsWith("_id")) {
    // 1. UUID types ke liye casting
    values.push(Prisma.sql`${value}::uuid`);
  } else if (name === "status") {
    // 2. FIXED: Status enum type ke liye explicitly ::user_status cast laga diya
    values.push(Prisma.sql`${value}::user_status`);
  } else {
    // 3. Normal text fields ke liye
    values.push(Prisma.sql`${value}`);
  }
}

function splitName(fullName) {
  const parts = normalizeText(fullName).split(/\s+/).filter(Boolean);
  return {
    firstName: parts[0] || "",
    lastName: parts.slice(1).join(" "),
  };
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

async function getRoleId(roleName) {
  const [row] = await prisma.$queryRaw`
    SELECT id::text AS id
    FROM roles
    WHERE LOWER(name) = ${roleName}
    LIMIT 1
  `;

  return row?.id || "";
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

  const [existing] = await prisma.$queryRaw(
    Prisma.sql`
      SELECT id::text AS id
      FROM users
      WHERE ${Prisma.join(conditions, ' OR ')}
      LIMIT 1
    `
  );

  if (existing?.id) {
    throw new Error("A user with this email or phone already exists.");
  }
}

async function insertAuditLog(actorUserId, targetUserId, action, description, metadata = {}) {
  await prisma.$executeRaw`
    INSERT INTO audit_logs (id, actor_user_id, entity_type, entity_id, action)
    VALUES (
      ${crypto.randomUUID()}::uuid,
      ${actorUserId}::uuid,
      ${"users"},
      ${targetUserId}::uuid,
      ${action}
    )
  `;
}

export async function GET(request) {
  const authState = await requireAdminSession();

  if (authState.error) {
    return authState.error;
  }

  const { searchParams } = new URL(request.url);
  const search = normalizeText(searchParams.get("search"));
  const role = normalizeText(searchParams.get("role")).toLowerCase();
  const status = normalizeText(searchParams.get("status")).toLowerCase();

  try {
    const users = await getUsers(search, role, status);
    return json("Users fetched.", 200, { items: users });
  } catch (error) {
    return json(
      error instanceof Error ? error.message : "Unable to fetch users.",
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
    const password = typeof body?.password === "string" ? body.password : "";
    const role = normalizeText(body?.role).toLowerCase();

    if (!ALLOWED_CREATE_ROLES.has(role)) {
      return json("Only coordinator and teacher accounts can be created here.", 400);
    }

    if (!fullName) {
      return json("Full name is required.", 400);
    }

    if (!email && !phone) {
      return json("Email or phone is required.", 400);
    }

    if (!password.trim() || password.trim().length < 8) {
      return json("Password must be at least 8 characters.", 400);
    }

    const roleId = await getRoleId(role);

    if (!roleId) {
      return json("Target role was not found in roles table.", 400);
    }

    await ensureUniqueUser(email, phone);

    const userId = crypto.randomUUID();
    const hashedPassword = await bcrypt.hash(password, 12);

    await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`
        INSERT INTO users (
          id,
          role_id,
          full_name,
          email,
          phone,
          password_hash,
          status,
          must_change_password
        )
        VALUES (
          ${userId}::uuid,
          ${roleId}::uuid,
          ${fullName},
          ${email || null},
          ${phone || null},
          ${hashedPassword},
          ${"active"}::user_status,
          ${true}
        )
      `;

      if (role === "coordinator") {
        await tx.$executeRaw`
          INSERT INTO coordinator_profiles (id, user_id, status)
          VALUES (${crypto.randomUUID()}::uuid, ${userId}::uuid, ${"active"}::user_status)
        `;
      } else {
        await tx.$executeRaw`
          INSERT INTO teacher_profiles (id, user_id, status)
          VALUES (${crypto.randomUUID()}::uuid, ${userId}::uuid, ${"active"}::user_status)
        `;
      }
    });

    await insertAuditLog(
      authState.session.user.id,
      userId,
      "user_created",
      `${role} account created by admin.`,
      { role }
    );

    return json("Staff user created.", 201, {
      item: {
        id: userId,
        name: fullName,
        email,
        phone,
        role,
        status: "active",
      },
    });
  } catch (error) {
    return json(
      error instanceof Error ? error.message : "Unable to create staff user.",
      500
    );
  }
}
