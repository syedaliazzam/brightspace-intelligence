import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

function json(message, status = 200, extra = {}) {
  return NextResponse.json({ message, ...extra }, { status });
}

export async function GET(_request, { params }) {
  try {
    const { token } = await params;
    const [item] = await prisma.$queryRaw`
      SELECT
        student_name,
        parent_name,
        email,
        phone,
        LOWER(status::text) AS status
      FROM interested_students
      WHERE registration_token = ${token}
        AND LOWER(status::text) IN ('link_generated', 'registered')
      LIMIT 1
    `;

    if (!item) {
      return json("Interested student not found.", 404);
    }

    return json("Interested student fetched.", 200, {
      item: {
        student_name: item.student_name || "",
        parent_name: item.parent_name || "",
        email: item.email || "",
        phone: item.phone || "",
      },
    });
  } catch (error) {
    return json(error instanceof Error ? error.message : "Unable to fetch interested student.", 500);
  }
}
