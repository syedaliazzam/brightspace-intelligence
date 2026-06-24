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

function generatePassword(length = 12) {
  return crypto
    .randomBytes(length)
    .toString("base64")
    .replace(/[^a-zA-Z0-9]/g, "")
    .slice(0, length);
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

async function insertAuditLog(actorUserId, targetUserId, action, description, metadata = {}) {
  const columns = await getTableColumns("audit_logs");

  if (!Object.keys(columns).length) {
    return;
  }

  const insertColumns = [];
  const insertValues = [];
  const supportedColumns = new Set();

  const addColumn = (name, value) => {
    insertColumns.push(Prisma.raw(name));
    insertValues.push(Prisma.sql`${value}`);
    supportedColumns.add(name);
  };

  if (columns.id) {
    addColumn("id", crypto.randomUUID());
  }
  if (columns.actor_user_id) {
    addColumn("actor_user_id", actorUserId);
  }
  if (columns.target_user_id) {
    addColumn("target_user_id", targetUserId);
  }
  if (columns.action) {
    addColumn("action", action);
  }
  if (columns.description) {
    addColumn("description", description);
  }
  if (columns.metadata) {
    addColumn("metadata", JSON.stringify(metadata));
  }
  if (columns.meta) {
    addColumn("meta", JSON.stringify(metadata));
  }

  const requiredUnsupported = Object.entries(columns)
    .filter(
      ([columnName, meta]) =>
        !meta.nullable && !meta.defaultValue && !supportedColumns.has(columnName)
    )
    .map(([columnName]) => columnName);

  if (requiredUnsupported.length) {
    return;
  }

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

export async function POST(request, { params }) {
  const session = await auth();
  const role = String(session?.user?.role || "").toLowerCase();

  if (!session?.user) {
    return json("Unauthorized.", 401);
  }

  if (role !== "admin") {
    return json("Forbidden.", 403);
  }

  try {
    const { id } = await params;
    const body = await request.json();
    const nextPassword = normalizeText(body?.newPassword) || generatePassword();

    if (nextPassword.length < 8) {
      return json("Password must be at least 8 characters.", 400);
    }

    const passwordHash = await nextPassword;
    const [updated] = await prisma.$queryRaw`
      UPDATE users
      SET password_hash = ${passwordHash}
      WHERE id = ${id}::uuid
      RETURNING id::text AS id
    `;

    if (!updated?.id) {
      return json("User not found.", 404);
    }

    await insertAuditLog(
      session.user.id,
      updated.id,
      "password_reset",
      "User password reset by admin.",
      {}
    );

    return json("Password reset.", 200, {
      temporaryPassword: nextPassword,
    });
  } catch (error) {
    return json(
      error instanceof Error ? error.message : "Unable to reset password.",
      500
    );
  }
}
