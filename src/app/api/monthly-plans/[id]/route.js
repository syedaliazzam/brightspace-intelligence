import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";

export async function PUT(request, { params }) {
  const session = await auth();
  const role = String(session?.user?.role || "").toLowerCase();
  const ALLOWED = new Set(["coordinator", "admin", "superadmin"]);
  if (!ALLOWED.has(role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const resolvedParams = await params;
    const id = String(resolvedParams?.id || "");
    if (!id) {
      return NextResponse.json({ error: "Missing id" }, { status: 400 });
    }
    const { name, startDate, endDate, imageUrls } = await request.json();

    await prisma.$executeRaw`
      UPDATE monthly_plans
      SET name = ${name}, start_date = ${startDate}::date, end_date = ${endDate}::date, image_urls = ${imageUrls}::text[]
      WHERE id = ${id}::uuid
    `;

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
