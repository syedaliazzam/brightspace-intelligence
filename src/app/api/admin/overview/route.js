import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";

function json(message, status = 200, extra = {}) {
  return NextResponse.json({ message, ...extra }, { status });
}

async function hasUserRolesTable() {
  const [row] = await prisma.$queryRaw`
    SELECT EXISTS (
      SELECT 1
      FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'user_roles'
    ) AS exists
  `;

  return Boolean(row?.exists);
}

async function getRoleCounts() {
  const hasUserRolesTable = await hasUserRolesTable();

  const rows = hasUserRolesTable
    ? await prisma.$queryRaw`
        WITH role_assignments AS (
          SELECT
            u.id::text AS user_id,
            LOWER(r.name) AS role_name
          FROM users u
          INNER JOIN roles r ON r.id = u.role_id

          UNION ALL

          SELECT
            ur.user_id::text AS user_id,
            LOWER(r2.name) AS role_name
          FROM user_roles ur
          INNER JOIN roles r2 ON r2.id = ur.role_id
        ),
        distinct_assignments AS (
          SELECT DISTINCT user_id, role_name
          FROM role_assignments
        )
        SELECT
          role_name,
          COUNT(*)::int AS total
        FROM distinct_assignments
        GROUP BY role_name
      `
    : await prisma.$queryRaw`
        SELECT
          LOWER(r.name) AS role_name,
          COUNT(*)::int AS total
        FROM users u
        INNER JOIN roles r ON r.id = u.role_id
        GROUP BY LOWER(r.name)
      `;

  return rows.reduce((accumulator, row) => {
    accumulator[row.role_name] = Number(row.total || 0);
    return accumulator;
  }, {});
}

async function getUserCount() {
  const hasUserRolesTable = await hasUserRolesTable();

  if (!hasUserRolesTable) {
    const [row] = await prisma.$queryRaw`
      SELECT COUNT(*)::int AS total
      FROM users
    `;

    return Number(row?.total || 0);
  }

  const [row] = await prisma.$queryRaw`
    WITH role_assignments AS (
      SELECT
        u.id::text AS user_id,
        LOWER(r.name) AS role_name
      FROM users u
      INNER JOIN roles r ON r.id = u.role_id

      UNION ALL

      SELECT
        ur.user_id::text AS user_id,
        LOWER(r2.name) AS role_name
      FROM user_roles ur
      INNER JOIN roles r2 ON r2.id = ur.role_id
    )
    SELECT COUNT(*)::int AS total
    FROM (
      SELECT DISTINCT user_id, role_name
      FROM role_assignments
    ) assignment_counts
  `;

  return Number(row?.total || 0);
}

async function getUserStatusCounts() {
  const hasUserRoles = await hasUserRolesTable();

  if (!hasUserRoles) {
    const rows = await prisma.$queryRaw`
      SELECT
        LOWER(status) AS status_name,
        COUNT(*)::int AS total
      FROM users
      GROUP BY LOWER(status)
    `;

    return rows.reduce((accumulator, row) => {
      accumulator[row.status_name] = Number(row.total || 0);
      return accumulator;
    }, {});
  }

  const rows = await prisma.$queryRaw`
    WITH role_assignments AS (
      SELECT
        u.id::text AS user_id,
        LOWER(r.name) AS role_name,
        LOWER(u.status::text) AS status
      FROM users u
      INNER JOIN roles r ON r.id = u.role_id

      UNION ALL

      SELECT
        ur.user_id::text AS user_id,
        LOWER(r2.name) AS role_name,
        LOWER(u2.status::text) AS status
      FROM user_roles ur
      INNER JOIN roles r2 ON r2.id = ur.role_id
      INNER JOIN users u2 ON u2.id = ur.user_id
    )
    SELECT
      status AS status_name,
      COUNT(*)::int AS total
    FROM (
      SELECT DISTINCT user_id, role_name, status
      FROM role_assignments
    ) assignments
    GROUP BY status
  `;

  return rows.reduce((accumulator, row) => {
    accumulator[row.status_name] = Number(row.total || 0);
    return accumulator;
  }, {});
}

async function getNewLeadCount() {
  try {
    const [row] = await prisma.$queryRaw`
      SELECT COUNT(*)::int AS total
      FROM registration_leads
      WHERE LOWER(status) = 'new_lead'
    `;

    return Number(row?.total || 0);
  } catch {
    return 0;
  }
}

export async function GET() {
  const session = await auth();
  const role = String(session?.user?.role || "").toLowerCase();

  if (!session?.user) {
    return json("Unauthorized.", 401);
  }

  if (role !== "admin" && role !== "superadmin") {
    return json("Forbidden.", 403);
  }

  try {
    const [roleCounts, totalUsers, statusCounts, newLeadCount] = await Promise.all([
      getRoleCounts(),
      getUserCount(),
      getUserStatusCounts(),
      getNewLeadCount(),
    ]);

    return json("Admin overview fetched.", 200, {
      stats: {
        totalUsers,
        totalStudents: roleCounts.student || 0,
        totalParents: roleCounts.parent || 0,
        totalTeachers: roleCounts.teacher || 0,
        totalCoordinators: roleCounts.coordinator || 0,
        activeUsers: statusCounts.active || 0,
        suspendedUsers: statusCounts.suspended || 0,
        newRegistrationLeads: newLeadCount,
      },
    });
  } catch (error) {
    return json(
      error instanceof Error ? error.message : "Unable to fetch admin overview.",
      500
    );
  }
}
