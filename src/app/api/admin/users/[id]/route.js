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
