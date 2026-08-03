import crypto from "crypto";
import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";

const ALLOWED_CREATE_ROLES = new Set(["admin", "coordinator", "teacher"]);
const ALLOWED_FILTER_ROLES = new Set([
  "superadmin",
  "admin",
  "coordinator",
  "teacher",
  "parent",
  "student",
]);
const ALLOWED_FILTER_STATUSES = new Set([
  "active",
  "suspended",
  "inactive",
  "archived",
]);

function json(message, status = 200, extra = {}) {
  return NextResponse.json({ message, ...extra }, { status });
}

function normalizeText(value) {
  return typeof value === "string" ? value.trim() : "";
}

function getRoleList(value) {
  return String(value || "")
    .split(",")
    .map((entry) => normalizeText(entry).toLowerCase())
    .filter(Boolean);
}

function getTemporaryPasswordValue(user) {
  const storedPassword = String(user.password_hash || "").trim();
  if (storedPassword) {
    return storedPassword;
  }

  const roleList = getRoleList(user.role);
  const hasStudentRole = roleList.includes("student");
  const hasParentRole = roleList.includes("parent");
  const hasStaffRole = roleList.some((role) =>
    ["superadmin", "admin", "coordinator", "teacher"].includes(role)
  );

  if (hasStudentRole) {
    return extractStudentTemporaryPassword(user.latest_credentials_body_text);
  }

  if (hasParentRole) {
    return extractParentTemporaryPassword(user.latest_credentials_body_text);
  }

  if (hasStaffRole) {
    return extractStaffTemporaryPassword(user.latest_credentials_body_text);
  }

  return extractTemporaryPassword(user.latest_credentials_body_text);
}

async function requireAdminSession() {
  const session = await auth();
  const role = String(session?.user?.role || "").toLowerCase();

  if (!session?.user) {
    return { error: json("Unauthorized.", 401) };
  }

  if (role !== "admin" && role !== "superadmin") {
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

function extractTemporaryPassword(bodyText) {
  const text = String(bodyText || "");
  const match = text.match(/Temporary Password:\s*(.+)/i);
  return match?.[1]?.trim() || "";
}

function extractStudentTemporaryPassword(bodyText) {
  const text = String(bodyText || "");
  const studentPasswordLabelMatch = text.match(
    /(?:Student\s+)?Password:\s*([^\n\r]+)/i
  );

  if (studentPasswordLabelMatch?.[1]) {
    return studentPasswordLabelMatch[1].trim();
  }

  const explicitStudentPasswordMatch = text.match(
    /Student Temporary Password:\s*([^\n\r]+)/i
  );

  if (explicitStudentPasswordMatch?.[1]) {
    return explicitStudentPasswordMatch[1].trim();
  }

  const studentSectionMatch = text.match(
    /Student Login[\s\S]*?Temporary Password:\s*([^\n\r]+)/i
  );

  if (studentSectionMatch?.[1]) {
    return studentSectionMatch[1].trim();
  }

  const matches = [...text.matchAll(/Temporary Password:\s*([^\n\r]+)/gi)];
  return matches.length > 1 ? matches[1][1].trim() : matches[0]?.[1]?.trim() || "";
}

function extractParentTemporaryPassword(bodyText) {
  const text = String(bodyText || "");
  const parentPasswordLabelMatch = text.match(
    /Parent Temporary Password:\s*([^\n\r]+)/i
  );

  if (parentPasswordLabelMatch?.[1]) {
    return parentPasswordLabelMatch[1].trim();
  }

  const parentSectionMatch = text.match(
    /Parent Login[\s\S]*?Temporary Password:\s*([^\n\r]+)/i
  );

  if (parentSectionMatch?.[1]) {
    return parentSectionMatch[1].trim();
  }

  return extractTemporaryPassword(text);
}

function extractStaffTemporaryPassword(bodyText) {
  const text = String(bodyText || "");
  const staffSectionMatch = text.match(
    /Staff Login[\s\S]*?Temporary Password:\s*([^\n\r]+)/i
  );

  if (staffSectionMatch?.[1]) {
    return staffSectionMatch[1].trim();
  }

  return extractTemporaryPassword(text);
}

async function getUsers(search, role, status, classLevel = "") {
  const userColumns = await getTableColumns("users");
  const displayNameSql = getDisplayNameSql(userColumns);
  const [tableCheck] = await prisma.$queryRaw(
    Prisma.sql`
      SELECT EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'user_roles'
      ) AS has_user_roles_table
    `
  );
  const hasUserRolesTable = Boolean(tableCheck?.has_user_roles_table);
  const conditions = [];

  if (role && ALLOWED_FILTER_ROLES.has(role)) {
    if (hasUserRolesTable) {
      conditions.push(Prisma.sql`
        (
          EXISTS (
            SELECT 1
            FROM user_roles ur
            INNER JOIN roles ur_role ON ur_role.id = ur.role_id
            WHERE ur.user_id = u.id
              AND LOWER(ur_role.name) = ${role}
          )
          OR LOWER(r.name) = ${role}
        )
      `);
    } else {
      conditions.push(Prisma.sql`LOWER(r.name) = ${role}`);
    }
  }

  if (status && ALLOWED_FILTER_STATUSES.has(status)) {
    conditions.push(Prisma.sql`LOWER(u.status::text) = ${status}`);
  }

  if (classLevel) {
    conditions.push(Prisma.sql`LOWER(COALESCE(sp.grade_level, '')) = ${classLevel.toLowerCase()}`);
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
      u.username,
      u.email,
      u.phone,
      u.password_hash,
      (
        SELECT COALESCE(om.body_text, om.body)
        FROM outbound_messages om
        WHERE LOWER(om.message_type) = 'payment_credentials'
          AND (
            LOWER(COALESCE(om.recipient_email, '')) = LOWER(COALESCE(u.email, ''))
            OR (COALESCE(u.username, '') <> '' AND COALESCE(om.body_text, om.body) ILIKE '%' || u.username || '%')
            OR (COALESCE(u.full_name, '') <> '' AND COALESCE(om.body_text, om.body) ILIKE '%' || u.full_name || '%')
          )
          AND (
            COALESCE(om.body_text, om.body) ILIKE '%Student Login%'
            OR COALESCE(om.body_text, om.body) ILIKE '%Staff Login%'
          )
        ORDER BY om.created_at DESC NULLS LAST
        LIMIT 1
      ) AS latest_credentials_body_text,
      COALESCE(sp.grade_level, '') AS class_level,
      sp.id::text AS student_profile_id,
      sp.admission_no,
      sp.age,
      sp.status::text AS student_profile_status,
      c.title AS course_title,
      rl.student_name AS lead_student_name,
      rl.parent_relation AS lead_parent_relation,
      rl.program_name,
      rl.gender,
      rl.date_of_birth,
      rl.city,
      rl.country,
      rl.nationality,
      rl.religion,
      rl.child_profile,
      rl.child_strengths,
      rl.child_support_needs,
      rl.child_special_interests,
      rl.developmental_concern,
      rl.developmental_concern_details,
      rl.medical_conditions,
      rl.support_person_during_learning,
      rl.device_available,
      pp.id::text AS parent_profile_id,
      COALESCE(primary_parent_user.full_name, rl.parent_name, '') AS parent_name,
      CASE
        WHEN LOWER(COALESCE(pp.relation, '')) IN ('', 'parent')
          THEN COALESCE(NULLIF(latest_registration.parent_relation, ''), COALESCE(pp.relation, ''))
        ELSE COALESCE(pp.relation, '')
      END AS relation,
      COALESCE(STRING_AGG(DISTINCT su.full_name, ', ' ORDER BY su.full_name) FILTER (WHERE su.full_name IS NOT NULL), '') AS student_names,
      LOWER(u.status::text) AS status,
      COALESCE(
        (
          SELECT STRING_AGG(DISTINCT role_name, ',' ORDER BY role_name)
          FROM (
            SELECT LOWER(r2.name) AS role_name
            FROM roles r2
            WHERE r2.id = u.role_id

            UNION

            SELECT LOWER(ur_role.name) AS role_name
            FROM user_roles ur
            INNER JOIN roles ur_role ON ur_role.id = ur.role_id
            WHERE ur.user_id = u.id
          ) all_roles
        ),
        LOWER(r.name)
      ) AS role,
      COALESCE(
        (
          SELECT STRING_AGG(DISTINCT role_name, ',' ORDER BY role_name)
          FROM (
            SELECT LOWER(r2.name) AS role_name
            FROM roles r2
            WHERE r2.id = u.role_id

            UNION

            SELECT LOWER(ur_role.name) AS role_name
            FROM user_roles ur
            INNER JOIN roles ur_role ON ur_role.id = ur.role_id
            WHERE ur.user_id = u.id
          ) all_roles
        ),
        LOWER(r.name)
      ) AS roles
    FROM users u
    INNER JOIN roles r ON r.id = u.role_id
    LEFT JOIN student_profiles sp ON sp.user_id = u.id
    LEFT JOIN enrollments e ON e.student_id = sp.id AND LOWER(e.status) = 'active'
    LEFT JOIN courses c ON c.id = e.course_id
    LEFT JOIN registration_leads rl ON rl.id = e.registration_id
    LEFT JOIN parent_profiles pp ON pp.user_id = u.id
    LEFT JOIN student_parents spp ON spp.parent_id = pp.id
    LEFT JOIN student_profiles linked_sp ON linked_sp.id = spp.student_id
    LEFT JOIN users su ON su.id = linked_sp.user_id
    LEFT JOIN student_parents spp_primary
      ON spp_primary.student_id = sp.id
     AND spp_primary.is_primary = TRUE
    LEFT JOIN parent_profiles pp_primary
      ON pp_primary.id = spp_primary.parent_id
    LEFT JOIN users primary_parent_user
      ON primary_parent_user.id = pp_primary.user_id
    LEFT JOIN LATERAL (
      SELECT rl.parent_relation
      FROM student_parents spp_latest
      INNER JOIN enrollments e ON e.student_id = spp_latest.student_id
      INNER JOIN registration_leads rl ON rl.id = e.registration_id
      WHERE spp_latest.parent_id = pp.id
      ORDER BY e.updated_at DESC NULLS LAST, e.created_at DESC NULLS LAST, rl.created_at DESC NULLS LAST
      LIMIT 1
      ) latest_registration ON TRUE
    ${whereClause}
    GROUP BY u.id, u.username, u.full_name, u.email, u.phone, sp.id, sp.admission_no, sp.age, sp.status, sp.grade_level, c.title, rl.student_name, rl.parent_name, rl.parent_relation, rl.program_name, rl.gender, rl.date_of_birth, rl.city, rl.country, rl.nationality, rl.religion, rl.child_profile, rl.child_strengths, rl.child_support_needs, rl.child_special_interests, rl.developmental_concern, rl.developmental_concern_details, rl.medical_conditions, rl.support_person_during_learning, rl.device_available, pp.id, pp.relation, latest_registration.parent_relation, primary_parent_user.full_name, u.status, r.name
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

async function findExistingUser(email, phone) {
  const conditions = [];

  if (email) {
    conditions.push(Prisma.sql`LOWER(email) = ${email.toLowerCase()}`);
  }

  if (phone) {
    conditions.push(Prisma.sql`phone = ${phone}`);
  }

  if (!conditions.length) {
    return null;
  }

  const [existing] = await prisma.$queryRaw(
    Prisma.sql`
      SELECT id::text AS id
      FROM users
      WHERE ${Prisma.join(conditions, ' OR ')}
      LIMIT 1
    `
  );

  return existing?.id || null;
}

async function ensureUserRoleAssignment(userId, roleId, tx = prisma) {
  const [tableCheck] = await tx.$queryRaw(
    Prisma.sql`
      SELECT EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'user_roles'
      ) AS has_user_roles_table
    `
  );

  if (tableCheck?.has_user_roles_table) {
    const [existingAssignment] = await tx.$queryRaw(
      Prisma.sql`
        SELECT 1
        FROM user_roles
        WHERE user_id = ${userId}::uuid
          AND role_id = ${roleId}::uuid
        LIMIT 1
      `
    );

    if (!existingAssignment) {
      await tx.$executeRaw(
        Prisma.sql`
          INSERT INTO user_roles (id, user_id, role_id, created_at)
          VALUES (
            ${crypto.randomUUID()}::uuid,
            ${userId}::uuid,
            ${roleId}::uuid,
            NOW()
          )
          ON CONFLICT (user_id, role_id) DO NOTHING
        `
      );
    }

    await tx.$executeRaw(
      Prisma.sql`
        UPDATE users
        SET role_id = COALESCE(role_id, ${roleId}::uuid)
        WHERE id = ${userId}::uuid
          AND (role_id IS NULL OR role_id = ${roleId}::uuid)
      `
    );
    return;
  }

  const [existingUser] = await tx.$queryRaw(
    Prisma.sql`
      SELECT role_id::text AS role_id
      FROM users
      WHERE id = ${userId}::uuid
      LIMIT 1
    `
  );

  if (!existingUser?.role_id) {
    await tx.$executeRaw(
      Prisma.sql`
        UPDATE users
        SET role_id = ${roleId}::uuid
        WHERE id = ${userId}::uuid
      `
    );
  }
}

async function ensureProfileForRole(userId, role, tx = prisma) {
  if (role === "coordinator") {
    const [existing] = await tx.$queryRaw(
      Prisma.sql`
        SELECT 1
        FROM coordinator_profiles
        WHERE user_id = ${userId}::uuid
        LIMIT 1
      `
    );

    if (!existing) {
      await tx.$executeRaw(
        Prisma.sql`
          INSERT INTO coordinator_profiles (id, user_id, status)
          VALUES (${crypto.randomUUID()}::uuid, ${userId}::uuid, ${"active"}::user_status)
        `
      );
    }
    return;
  }

  if (role === "teacher") {
    const [existing] = await tx.$queryRaw(
      Prisma.sql`
        SELECT 1
        FROM teacher_profiles
        WHERE user_id = ${userId}::uuid
        LIMIT 1
      `
    );

    if (!existing) {
      await tx.$executeRaw(
        Prisma.sql`
          INSERT INTO teacher_profiles (id, user_id, status)
          VALUES (${crypto.randomUUID()}::uuid, ${userId}::uuid, ${"active"}::user_status)
        `
      );
    }
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
  const classLevel = normalizeText(searchParams.get("class_level"));

  try {
    const users = await getUsers(search, role, status, classLevel);
    const normalizedUsers = users.map((user) => ({
      ...user,
      temporary_password: getTemporaryPasswordValue(user),
    }));
    return json("Users fetched.", 200, {
      items: normalizedUsers,
      summary: {
        total: normalizedUsers.length,
        students: normalizedUsers.filter((item) => getRoleList(item.role).includes("student")).length,
        parents: normalizedUsers.filter((item) => getRoleList(item.role).includes("parent")).length,
        active: normalizedUsers.filter((item) => item.status === "active").length,
        suspended: normalizedUsers.filter((item) => item.status === "suspended").length,
        archived: normalizedUsers.filter((item) => item.status === "archived").length,
      },
    });
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
      return json("Only admin, coordinator, and teacher accounts can be created here.", 400);
    }

    if (!fullName) {
      return json("Full name is required.", 400);
    }

    if (!email && !phone) {
      return json("Email is required.", 400);
    }

    const roleId = await getRoleId(role);

    if (!roleId) {
      return json("Target role was not found in roles table.", 400);
    }

    const existingUserId = await findExistingUser(email, phone);
    const isExistingUser = Boolean(existingUserId);

    if (!isExistingUser && (!password.trim() || password.trim().length < 8)) {
      return json("Password must be at least 8 characters.", 400);
    }

    const userId = existingUserId || crypto.randomUUID();
    const hashedPassword = password.trim() || "";

    await prisma.$transaction(async (tx) => {
      if (!isExistingUser) {
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
      } else {
        await tx.$executeRaw`
          UPDATE users
          SET full_name = ${fullName},
              email = ${email || null},
              phone = ${phone || null},
              status = ${"active"}::user_status,
              must_change_password = ${true}
          WHERE id = ${userId}::uuid
        `;
      }

      await ensureUserRoleAssignment(userId, roleId, tx);
      await ensureProfileForRole(userId, role, tx);
    });

    await insertAuditLog(
      authState.session.user.id,
      userId,
      isExistingUser ? "user_role_assigned" : "user_created",
      isExistingUser
        ? `${role} role assigned to existing user by admin.`
        : `${role} account created by admin.`,
      { role, existingUser: isExistingUser }
    );

    return json(isExistingUser ? "Role assigned to existing user." : "Staff user created.", 201, {
      item: {
        id: userId,
        name: fullName,
        email,
        phone,
        role,
        status: "active",
        existingUser: isExistingUser,
      },
    });
  } catch (error) {
    return json(
      error instanceof Error ? error.message : "Unable to create staff user.",
      500
    );
  }
}
