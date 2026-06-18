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
  const columns = await getTableColumns("audit_logs");

  if (!Object.keys(columns).length) {
    return;
  }

  const insertColumns = [];
  const insertValues = [];
  const supportedColumns = new Set();

  if (columns.id) {
    addColumn(insertColumns, insertValues, "id", crypto.randomUUID());
    supportedColumns.add("id");
  }
  if (columns.actor_user_id) {
    addColumn(insertColumns, insertValues, "actor_user_id", actorUserId);
    supportedColumns.add("actor_user_id");
  }
  
  // FIXED: entity_type aur entity_id ko support mein add kiya taake framework validation fail na ho
  if (columns.entity_type) {
    addColumn(insertColumns, insertValues, "entity_type", "users"); // Chunki hum users page par hain
    supportedColumns.add("entity_type");
  }
  if (columns.entity_id) {
    addColumn(insertColumns, insertValues, "entity_id", targetUserId); // Jis user par action hua uski ID
    supportedColumns.add("entity_id");
  }

  if (columns.action) {
    addColumn(insertColumns, insertValues, "action", action);
    supportedColumns.add("action");
  }
  if (columns.description) {
    addColumn(insertColumns, insertValues, "description", description);
    supportedColumns.add("description");
  }
  if (columns.metadata) {
    addColumn(insertColumns, insertValues, "metadata", JSON.stringify(metadata));
    supportedColumns.add("metadata");
  }
  if (columns.meta) {
    addColumn(insertColumns, insertValues, "meta", JSON.stringify(metadata));
    supportedColumns.add("meta");
  }

  ensureSupportedRequiredColumns("audit_logs", columns, supportedColumns);

  if (!insertColumns.length) {
    return;
  }

  await prisma.$executeRaw(
    Prisma.sql`
      INSERT INTO audit_logs (${Prisma.join(insertColumns, Prisma.sql`, `)})
      VALUES (${Prisma.join(insertValues, Prisma.sql`, `)})
    `
  );
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

    const userColumns = await getTableColumns("users");
    const { firstName, lastName } = splitName(fullName);
    const insertColumns = [];
    const insertValues = [];
    const supportedColumns = new Set();
    const userId = crypto.randomUUID();
    const hashedPassword = await bcrypt.hash(password, 12);

    addColumn(insertColumns, insertValues, "id", userId);
    supportedColumns.add("id");
    addColumn(insertColumns, insertValues, "role_id", roleId);
    supportedColumns.add("role_id");
    addColumn(insertColumns, insertValues, "password_hash", hashedPassword);
    supportedColumns.add("password_hash");
    addColumn(insertColumns, insertValues, "status", "active");
    supportedColumns.add("status");

    if (userColumns.email) {
      addColumn(insertColumns, insertValues, "email", email || null);
      supportedColumns.add("email");
    }
    if (userColumns.phone) {
      addColumn(insertColumns, insertValues, "phone", phone || null);
      supportedColumns.add("phone");
    }
    if (userColumns.full_name) {
      addColumn(insertColumns, insertValues, "full_name", fullName);
      supportedColumns.add("full_name");
    }
    if (userColumns.name) {
      addColumn(insertColumns, insertValues, "name", fullName);
      supportedColumns.add("name");
    }
    if (userColumns.first_name) {
      addColumn(insertColumns, insertValues, "first_name", firstName);
      supportedColumns.add("first_name");
    }
    if (userColumns.last_name) {
      addColumn(insertColumns, insertValues, "last_name", lastName);
      supportedColumns.add("last_name");
    }

    ensureSupportedRequiredColumns("users", userColumns, supportedColumns);

    await prisma.$transaction(async (tx) => {
      await tx.$executeRaw(
        Prisma.sql`
          INSERT INTO users (${Prisma.join(insertColumns, ', ')})
          VALUES (${Prisma.join(insertValues, ', ')})
        `
      );

      const profileTable =
        role === "coordinator" ? "coordinator_profiles" : "teacher_profiles";
      const profileColumns = await tx.$queryRaw`
        SELECT
          column_name,
          is_nullable,
          column_default
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = ${profileTable}
      `;

      const profileMap = profileColumns.reduce((accumulator, row) => {
        accumulator[row.column_name] = {
          nullable: row.is_nullable === "YES",
          defaultValue: row.column_default,
        };
        return accumulator;
      }, {});

      if (Object.keys(profileMap).length) {
        const profileInsertColumns = [];
        const profileInsertValues = [];
        const profileSupported = new Set();

        if (profileMap.id) {
          addColumn(profileInsertColumns, profileInsertValues, "id", crypto.randomUUID());
          profileSupported.add("id");
        }
        if (profileMap.user_id) {
          addColumn(profileInsertColumns, profileInsertValues, "user_id", userId);
          profileSupported.add("user_id");
        }
        if (profileMap.full_name) {
          addColumn(profileInsertColumns, profileInsertValues, "full_name", fullName);
          profileSupported.add("full_name");
        }
        if (profileMap.name) {
          addColumn(profileInsertColumns, profileInsertValues, "name", fullName);
          profileSupported.add("name");
        }
        if (profileMap.first_name) {
          addColumn(profileInsertColumns, profileInsertValues, "first_name", firstName);
          profileSupported.add("first_name");
        }
        if (profileMap.last_name) {
          addColumn(profileInsertColumns, profileInsertValues, "last_name", lastName);
          profileSupported.add("last_name");
        }
        if (profileMap.email) {
          addColumn(profileInsertColumns, profileInsertValues, "email", email || null);
          profileSupported.add("email");
        }
        if (profileMap.phone) {
          addColumn(profileInsertColumns, profileInsertValues, "phone", phone || null);
          profileSupported.add("phone");
        }
        if (profileMap.status) {
          addColumn(profileInsertColumns, profileInsertValues, "status", "active");
          profileSupported.add("status");
        }

        const requiredUnsupported = Object.entries(profileMap)
          .filter(
            ([columnName, meta]) =>
              !meta.nullable &&
              !meta.defaultValue &&
              !profileSupported.has(columnName)
          )
          .map(([columnName]) => columnName);

        if (requiredUnsupported.length) {
          throw new Error(
            `${profileTable} requires unsupported columns: ${requiredUnsupported.join(", ")}.`
          );
        }

        if (profileInsertColumns.length) {
          // FIXED: Separators sorted out to prevent the 42601 Object interpretation error.
          await tx.$executeRaw(
            Prisma.sql`
              INSERT INTO ${Prisma.raw(`"${profileTable}"`)} (${Prisma.join(profileInsertColumns, ', ')})
              VALUES (${Prisma.join(profileInsertValues, ', ')})
            `
          );
        }
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