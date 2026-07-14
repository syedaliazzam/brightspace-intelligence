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

function normalizeMoney(value) {
  const amount = Number(value);
  return Number.isFinite(amount) && amount >= 0 ? amount : null;
}

async function requireAdminSession() {
  const session = await auth();
  const role = String(session?.user?.role || "").toLowerCase();

  if (!session?.user) return { error: json("Unauthorized.", 401) };
  if (role !== "admin" && role !== "superadmin") return { error: json("Forbidden.", 403) };
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

async function getColumns(tableName) {
  const rows = await prisma.$queryRaw`
    SELECT column_name, data_type, udt_name
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

function valueSql(columnMeta, value) {
  if (!columnMeta || value === null || typeof value === "undefined") {
    return Prisma.sql`${value ?? null}`;
  }
  if (columnMeta.udtName === "uuid") return Prisma.sql`${value}::uuid`;
  if (columnMeta.dataType === "USER-DEFINED" && columnMeta.udtName) {
    return Prisma.sql`${value}::${Prisma.raw(columnMeta.udtName)}`;
  }
  return Prisma.sql`${value}`;
}

function getLabelSql(columns) {
  if (columns.name) return Prisma.sql`COALESCE(NULLIF(rf.name, ''), rf.class_level, 'Regular Fee')`;
  if (columns.title) return Prisma.sql`COALESCE(NULLIF(rf.title, ''), rf.class_level, 'Regular Fee')`;
  return Prisma.sql`COALESCE(rf.class_level, 'Regular Fee')`;
}

function statusSql(columns) {
  return columns.status
    ? Prisma.sql`LOWER(rf.status::text) AS status`
    : Prisma.sql`'active' AS status`;
}

export async function GET() {
  const authState = await requireAdminSession();
  if (authState.error) return authState.error;

  try {
    if (!(await tableExists("regular_fee"))) {
      return json("Regular fee table is not available yet.", 200, {
        available: false,
        items: [],
      });
    }

    const items = await prisma.$queryRaw`
      SELECT
        rf.id::text AS id,
        rf.class_level,
        COALESCE(rf.name, 'Regular Fee') AS name,
        rf.amount::text AS amount,
        rf.status,
        rf.created_at,
        rf.updated_at
      FROM regular_fee rf
      ORDER BY rf.created_at DESC NULLS LAST, rf.id DESC
    `;

    return json("Regular fees fetched.", 200, { available: true, items });
  } catch (error) {
    return json(error instanceof Error ? error.message : "Unable to fetch regular fees.", 500);
  }
}

export async function POST(request) {
  const authState = await requireAdminSession();
  if (authState.error) return authState.error;

  try {
    if (!(await tableExists("regular_fee"))) {
      return json("Regular fee table is not available yet.", 400);
    }

    const body = await request.json();
    const classLevel = normalizeText(body?.class_level || body?.classLevel);
    const name = normalizeText(body?.name || body?.title);
    const amount = normalizeMoney(body?.amount);
    const status = normalizeText(body?.status).toLowerCase() || "active";

    if (!classLevel) return json("Class level is required.", 400);
    if (!name) return json("Name is required.", 400);
    if (amount === null) return json("Amount must be zero or greater.", 400);

    const columns = await getColumns("regular_fee");
    const insertColumns = [];
    const insertValues = [];

    const push = (columnName, value) => {
      if (columns[columnName]) {
        insertColumns.push(Prisma.raw(`"${columnName}"`));
        insertValues.push(valueSql(columns[columnName], value));
      }
    };

    push("id", crypto.randomUUID());
    push("class_level", classLevel);
    push("name", name);
    push("title", name);
    push("amount", amount);
    push("status", status);
    push("created_at", new Date());
    push("updated_at", new Date());

    await prisma.$executeRaw(
      Prisma.sql`INSERT INTO regular_fee (${Prisma.join(insertColumns, ", ")}) VALUES (${Prisma.join(insertValues, ", ")})`
    );

    return json("Regular fee created.", 201);
  } catch (error) {
    return json(error instanceof Error ? error.message : "Unable to create regular fee.", 500);
  }
}

export async function PATCH(request) {
  const authState = await requireAdminSession();
  if (authState.error) return authState.error;

  try {
    if (!(await tableExists("regular_fee"))) {
      return json("Regular fee table is not available yet.", 400);
    }

    const body = await request.json();
    const id = normalizeText(body?.id);
    const classLevel = normalizeText(body?.class_level || body?.classLevel);
    const name = normalizeText(body?.name || body?.title);
    const amount = normalizeMoney(body?.amount);
    const status = normalizeText(body?.status).toLowerCase();

    if (!id) return json("Regular fee id is required.", 400);

    const columns = await getColumns("regular_fee");
    const sets = [];
    if (classLevel && columns.class_level) sets.push(Prisma.sql`class_level = ${classLevel}`);
    if (name) {
      if (columns.name) sets.push(Prisma.sql`name = ${name}`);
      if (columns.title) sets.push(Prisma.sql`title = ${name}`);
    }
    if (amount !== null && columns.amount) sets.push(Prisma.sql`amount = ${amount}`);
    if (status && columns.status) sets.push(Prisma.sql`status = ${status}`);
    if (columns.updated_at) sets.push(Prisma.sql`updated_at = NOW()`);

    if (!sets.length) return json("No supported fields were provided.", 400);

    await prisma.$executeRaw(
      Prisma.sql`UPDATE regular_fee SET ${Prisma.join(sets, Prisma.sql`, `)} WHERE id = ${id}::uuid`
    );

    return json("Regular fee updated.");
  } catch (error) {
    return json(error instanceof Error ? error.message : "Unable to update regular fee.", 500);
  }
}
