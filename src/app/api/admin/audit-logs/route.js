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

async function getTableColumns(tableName) {
  const rows = await prisma.$queryRaw`
    SELECT column_name
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = ${tableName}
  `;

  return rows.reduce((accumulator, row) => {
    accumulator[row.column_name] = true;
    return accumulator;
  }, {});
}

export async function GET(request) {
  const authState = await requireAdminSession();

  if (authState.error) {
    return authState.error;
  }

  try {
    if (!(await tableExists("audit_logs"))) {
      return json("Audit logs table is not available yet.", 200, {
        available: false,
        items: [],
        summary: { total: 0, recent: 0 },
      });
    }

    const columns = await getTableColumns("audit_logs");
    const { searchParams } = new URL(request.url);
    const search = normalizeText(searchParams.get("search"));
    const action = normalizeText(searchParams.get("action")).toLowerCase();
    const entityType = normalizeText(searchParams.get("entityType")).toLowerCase();
    const conditions = [];

    if (action && columns.action) {
      conditions.push(Prisma.sql`LOWER(al.action) = ${action}`);
    }

    if (entityType && columns.entity_type) {
      conditions.push(Prisma.sql`LOWER(al.entity_type) = ${entityType}`);
    }

    if (search) {
      const term = `%${search}%`;
      const searchConditions = [];

      if (columns.description) {
        searchConditions.push(Prisma.sql`al.description ILIKE ${term}`);
      }
      if (columns.action) {
        searchConditions.push(Prisma.sql`al.action ILIKE ${term}`);
      }
      if (columns.entity_type) {
        searchConditions.push(Prisma.sql`al.entity_type ILIKE ${term}`);
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
          al.id::text AS id,
          ${columns.action ? Prisma.sql`al.action,` : Prisma.sql`'unknown' AS action,`}
          ${columns.description ? Prisma.sql`al.description,` : Prisma.sql`'' AS description,`}
          ${columns.entity_type ? Prisma.sql`COALESCE(al.entity_type, 'system') AS entity_type,` : Prisma.sql`'system' AS entity_type,`}
          ${columns.entity_id ? Prisma.sql`COALESCE(al.entity_id::text, '') AS entity_id,` : Prisma.sql`'' AS entity_id,`}
          ${columns.created_at ? Prisma.sql`al.created_at,` : Prisma.sql`NULL AS created_at,`}
          COALESCE(actor.full_name, actor.email, actor.phone, 'System') AS actor_name
        FROM audit_logs al
        LEFT JOIN users actor ON actor.id = al.actor_user_id
        ${whereClause}
        ORDER BY ${columns.created_at ? Prisma.sql`al.created_at DESC NULLS LAST` : Prisma.sql`al.id DESC`}
        LIMIT 100
      `
    );

    const recent = columns.created_at
      ? await prisma.$queryRaw`
          SELECT COUNT(*)::int AS total
          FROM audit_logs
          WHERE created_at >= NOW() - INTERVAL '7 days'
        `
      : [{ total: 0 }];

    return json("Audit logs fetched.", 200, {
      available: true,
      items,
      summary: {
        total: items.length,
        recent: Number(recent?.[0]?.total || 0),
      },
    });
  } catch (error) {
    return json(
      error instanceof Error ? error.message : "Unable to fetch audit logs.",
      500
    );
  }
}
