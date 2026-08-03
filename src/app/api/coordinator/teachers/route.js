import crypto from "crypto";
import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireRole, roleGuardResponse } from "@/lib/roleGuard";

const ALLOWED_ROLES = ["coordinator", "admin", "superadmin"];

function json(message, status = 200, extra = {}) {
  return NextResponse.json({ message, ...extra }, { status });
}

function normalizeText(value) {
  return typeof value === "string" ? value.trim() : "";
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

async function findExistingUser(email, phone, excludeId = "") {
  let row;
  const excludeClause = excludeId ? Prisma.sql`AND id <> ${excludeId}::uuid` : Prisma.empty;

  if (email && phone) {
    [row] = await prisma.$queryRaw`
      SELECT id::text AS id
      FROM users
      WHERE (
        LOWER(email) = ${email.toLowerCase()}
        OR phone = ${phone}
      )
      ${excludeClause}
      LIMIT 1
    `;
  } else if (email) {
    [row] = await prisma.$queryRaw`
      SELECT id::text AS id
      FROM users
      WHERE LOWER(email) = ${email.toLowerCase()}
        ${excludeClause}
      LIMIT 1
    `;
  } else if (phone) {
    [row] = await prisma.$queryRaw`
      SELECT id::text AS id
      FROM users
      WHERE phone = ${phone}
        ${excludeClause}
      LIMIT 1
    `;
  } else {
    return null;
  }

  return row?.id || null;
}

async function ensureUniqueUser(email, phone, excludeId = "") {
  const existingUserId = await findExistingUser(email, phone, excludeId);

  if (!existingUserId) {
    return;
  }

  throw new Error(
    "A user with the same email or phone already exists. Please use a different email or phone."
  );
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

async function syncTeacherProfile(userId, status = "active", tx = prisma) {
  const profileId = crypto.randomUUID();
  await tx.$executeRaw`
    INSERT INTO teacher_profiles (id, user_id, status)
    VALUES (${profileId}::uuid, ${userId}::uuid, ${status}::user_status)
  `;
}

async function getUserRoleId(userId, tx = prisma) {
  const [row] = await tx.$queryRaw`
    SELECT role_id::text AS role_id
    FROM users
    WHERE id = ${userId}::uuid
    LIMIT 1
  `;

  return row?.role_id || "";
}

async function isTeacherRecord(userId, tx = prisma) {
  const teacherRoleId = await getRoleId("teacher", tx);

  const [tableCheck] = await tx.$queryRaw(
    Prisma.sql`
      SELECT EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'user_roles'
      ) AS has_user_roles_table
    `
  );

  const hasUserRolesTable = Boolean(tableCheck?.has_user_roles_table);

  if (hasUserRolesTable) {
    const [row] = await tx.$queryRaw`
      SELECT EXISTS (
        SELECT 1
        FROM users u
        WHERE u.id = ${userId}::uuid AND (
          u.role_id = ${teacherRoleId}::uuid
          OR EXISTS (
            SELECT 1
            FROM user_roles ur
            WHERE ur.user_id = u.id
              AND ur.role_id = ${teacherRoleId}::uuid
          )
          OR EXISTS (
            SELECT 1
            FROM teacher_profiles tp
            WHERE tp.user_id = u.id
          )
        )
      ) AS is_teacher
    `;

    return Boolean(row?.is_teacher);
  }

  const [row] = await tx.$queryRaw`
    SELECT EXISTS (
      SELECT 1
      FROM users u
      WHERE u.id = ${userId}::uuid AND (
        u.role_id = ${teacherRoleId}::uuid
        OR EXISTS (
          SELECT 1
          FROM teacher_profiles tp
          WHERE tp.user_id = u.id
        )
      )
    ) AS is_teacher
  `;

  return Boolean(row?.is_teacher);
}

export async function POST(request) {
  try {
    const session = await requireRole(ALLOWED_ROLES);
    const body = await request.json();
    const fullName = normalizeText(body?.fullName);
    const email = normalizeText(body?.email).toLowerCase();
    const phone = normalizeText(body?.phone);
    const password = normalizeText(body?.password);

    if (!fullName) {
      return json("Full name is required.", 400);
    }

    if (!email && !phone) {
      return json("Email is required.", 400);
    }

    const existingUserId = await findExistingUser(email, phone);
    const isExistingUser = Boolean(existingUserId);

    if (!isExistingUser && password.length < 8) {
      return json("Password must be at least 8 characters.", 400);
    }

    const roleId = await getRoleId("teacher");
    const userId = existingUserId || crypto.randomUUID();

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
            ${password},
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
      await syncTeacherProfile(userId, "active", tx);
    });

    return json(isExistingUser ? "Teacher role assigned to existing user." : "Teacher user created.", 201, {
      item: {
        id: userId,
        name: fullName,
        email,
        phone,
        role: "teacher",
        status: "active",
        editable: true,
        temporary_password: password,
        existingUser: isExistingUser,
      },
    });
  } catch (error) {
    const guard = roleGuardResponse(error);
    if (guard) {
      return guard;
    }

    return json(
      error instanceof Error ? error.message : "Unable to create teacher user.",
      500
    );
  }
}

export async function GET() {
  try {
    await requireRole(ALLOWED_ROLES);

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

    const items = hasUserRolesTable
      ? await prisma.$queryRaw`
          SELECT
            u.id::text AS id,
            u.full_name AS full_name,
            u.email,
            u.phone,
            LOWER(u.status::text) AS status,
            'teacher'::text AS roles,
            'teacher'::text AS role,
            u.created_at
          FROM users u
          INNER JOIN roles r ON r.id = u.role_id
          LEFT JOIN user_roles ur ON ur.user_id = u.id
          LEFT JOIN roles ur_role ON ur_role.id = ur.role_id
          LEFT JOIN teacher_profiles tp ON tp.user_id = u.id
          WHERE (
            EXISTS (
              SELECT 1
              FROM user_roles ur2
              INNER JOIN roles ur_role2 ON ur_role2.id = ur2.role_id
              WHERE ur2.user_id = u.id
                AND LOWER(ur_role2.name) = 'teacher'
            )
            OR LOWER(r.name) = 'teacher'
          )
          GROUP BY u.id, u.full_name, u.email, u.phone, u.status, r.name, u.created_at
          ORDER BY u.created_at DESC NULLS LAST, u.id DESC
        `
      : await prisma.$queryRaw`
          SELECT
            u.id::text AS id,
            u.full_name AS full_name,
            u.email,
            u.phone,
            LOWER(u.status::text) AS status,
            'teacher'::text AS roles,
            'teacher'::text AS role,
            u.created_at
          FROM users u
          INNER JOIN roles r ON r.id = u.role_id
          LEFT JOIN teacher_profiles tp ON tp.user_id = u.id
          WHERE LOWER(r.name) = 'teacher'
          ORDER BY u.created_at DESC NULLS LAST, u.id DESC
        `;

    return json("Teachers fetched.", 200, { items });
  } catch (error) {
    const guard = roleGuardResponse(error);
    if (guard) {
      return guard;
    }

    return json(
      error instanceof Error ? error.message : "Unable to fetch teachers.",
      500
    );
  }
}

export async function PATCH(request) {
  try {
    await requireRole(ALLOWED_ROLES);
    const body = await request.json();
    const teacherId = normalizeText(body?.id);
    const fullName = normalizeText(body?.fullName);
    const email = normalizeText(body?.email).toLowerCase();
    const phone = normalizeText(body?.phone);
    const status = normalizeText(body?.status).toLowerCase() || "active";

    if (!teacherId) {
      return json("Teacher id is required.", 400);
    }

    if (!fullName) {
      return json("Full name is required.", 400);
    }

    const [existing] = await prisma.$queryRaw`
      SELECT id::text AS id, email, phone
      FROM users
      WHERE id = ${teacherId}::uuid
      LIMIT 1
    `;

    if (!existing?.id) {
      return json("Teacher not found.", 404);
    }

    const isTeacher = await isTeacherRecord(teacherId);
    if (!isTeacher) {
      return json("Selected record is not a teacher.", 400);
    }

    if ((email && email !== existing.email) || (phone && phone !== existing.phone)) {
      await ensureUniqueUser(email || existing.email || "", phone || existing.phone || "", teacherId);
    }

    await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`
        UPDATE users
        SET full_name = ${fullName},
            email = ${email || null},
            phone = ${phone || null},
            status = ${status}::user_status,
            updated_at = NOW()
        WHERE id = ${teacherId}::uuid
      `;

      const [profile] = await tx.$queryRaw`
        SELECT id::text AS id
        FROM teacher_profiles
        WHERE user_id = ${teacherId}::uuid
        LIMIT 1
      `;

      if (!profile?.id) {
        await syncTeacherProfile(teacherId, status, tx);
      } else {
        await tx.$executeRaw`
          UPDATE teacher_profiles
          SET status = ${status}::user_status
          WHERE user_id = ${teacherId}::uuid
        `;
      }
    });

    return json("Teacher updated.", 200, {
      item: {
        id: teacherId,
        name: fullName,
        email,
        phone,
        role: "teacher",
        status,
      },
    });
  } catch (error) {
    const guard = roleGuardResponse(error);
    if (guard) {
      return guard;
    }

    return json(
      error instanceof Error ? error.message : "Unable to update teacher.",
      500
    );
  }
}
