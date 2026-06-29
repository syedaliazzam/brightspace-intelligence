import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";

function json(message, status = 200, extra = {}) {
  return NextResponse.json({ message, ...extra }, { status });
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

async function getUserById(id) {
  const [row] = await prisma.$queryRaw`
    SELECT
      u.id::text AS id,
      COALESCE(u.full_name, '') AS full_name,
      COALESCE(NULLIF(u.full_name, ''), NULLIF(u.email, ''), NULLIF(u.phone, ''), 'User') AS name,
      u.email,
      u.phone,
      CASE
        WHEN LOWER(COALESCE(pp.relation, '')) IN ('', 'parent')
          THEN COALESCE(NULLIF(latest_registration.parent_relation, ''), COALESCE(pp.relation, ''))
        ELSE COALESCE(pp.relation, '')
      END AS relation,
      COALESCE(STRING_AGG(DISTINCT su.full_name, ', ' ORDER BY su.full_name) FILTER (WHERE su.full_name IS NOT NULL), '') AS student_names,
      LOWER(u.status::text) AS status,
      LOWER(r.name) AS role
    FROM users u
    INNER JOIN roles r ON r.id = u.role_id
    LEFT JOIN parent_profiles pp ON pp.user_id = u.id
    LEFT JOIN student_parents spp ON spp.parent_id = pp.id
    LEFT JOIN student_profiles sp ON sp.id = spp.student_id
    LEFT JOIN users su ON su.id = sp.user_id
    LEFT JOIN LATERAL (
      SELECT rl.parent_relation
      FROM student_parents spp_latest
      INNER JOIN enrollments e ON e.student_id = spp_latest.student_id
      INNER JOIN registration_leads rl ON rl.id = e.registration_id
      WHERE spp_latest.parent_id = pp.id
      ORDER BY e.updated_at DESC NULLS LAST, e.created_at DESC NULLS LAST, rl.created_at DESC NULLS LAST
      LIMIT 1
    ) latest_registration ON TRUE
    WHERE u.id = ${id}::uuid
    GROUP BY u.id, u.full_name, u.email, u.phone, pp.relation, latest_registration.parent_relation, u.status, r.name
    LIMIT 1
  `;

  return row;
}

export async function DELETE(_request, { params }) {
  const authState = await requireAdminSession();

  if (authState.error) {
    return authState.error;
  }

  try {
    const { id } = await params;
    const [updated] = await prisma.$queryRaw`
      UPDATE users
      SET status = ${"archived"}::user_status
      WHERE id = ${id}::uuid
      RETURNING id::text AS id
    `;

    if (!updated?.id) {
      return json("User not found.", 404);
    }

    return json("User archived.", 200, { item: updated });
  } catch (error) {
    return json(
      error instanceof Error ? error.message : "Unable to delete user.",
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
    const body = await request.json().catch(() => ({}));
    const fullName = String(body?.fullName || "").trim();
    const email = String(body?.email || "").trim().toLowerCase();
    const phone = String(body?.phone || "").trim();
    const relation = String(body?.relation || "").trim().toLowerCase();
    const nextStatus = String(body?.status || existing.status || "active").toLowerCase();

    if (!["active", "suspended", "archived"].includes(nextStatus)) {
      return json("Invalid user status.", 400);
    }

    if (!existing?.id) {
      return json("User not found.", 404);
    }

    if (
      fullName ||
      email ||
      phone ||
      relation ||
      (existing.status && nextStatus !== existing.status)
    ) {
      await prisma.$transaction(async (tx) => {
        await tx.$executeRaw`
          UPDATE users
          SET
            full_name = ${fullName || existing.full_name || existing.name},
            email = ${email || null},
            phone = ${phone || null},
            status = ${nextStatus}::user_status,
            updated_at = NOW()
          WHERE id = ${id}::uuid
        `;

        if (existing.role === "parent") {
          await tx.$executeRaw`
            UPDATE parent_profiles
            SET relation = ${relation || existing.relation || null}, updated_at = NOW()
            WHERE user_id = ${id}::uuid
          `;
        }
      });
    } else {
      await prisma.$executeRaw`
        UPDATE users
        SET status = ${nextStatus}::user_status,
            updated_at = NOW()
        WHERE id = ${id}::uuid
      `;
    }

    const updated = await getUserById(id);
    return json("User updated.", 200, { item: updated });
  } catch (error) {
    return json(
      error instanceof Error ? error.message : "Unable to update user.",
      500
    );
  }
}
