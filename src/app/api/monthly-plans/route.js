import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";

const COORDINATOR_ONLY = new Set(["coordinator"]);

export async function GET(request) {
  const session = await auth();

  try {
    const plans = await prisma.$queryRaw`
      SELECT id, name, start_date, end_date, image_urls
      FROM monthly_plans
      ORDER BY start_date DESC
    `;

    return NextResponse.json({ items: plans || [] });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request) {
  const session = await auth();
  const role = String(session?.user?.role || "").toLowerCase();

  // Allow coordinators, admins and superadmins to create plans
  const ALLOWED_CREATE = new Set(["coordinator", "admin", "superadmin"]);
  if (!ALLOWED_CREATE.has(role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const { name, startDate, endDate, imageUrls } = await request.json();

    if (!name || !startDate || !endDate) {
      return NextResponse.json({ error: "Name, start date, and end date are required" }, { status: 400 });
    }

    // Check if a plan already exists for this month
    const startDateObj = new Date(startDate);
    const monthYear = `${startDateObj.getFullYear()}-${String(startDateObj.getMonth() + 1).padStart(2, "0")}`;

    const [existingPlan] = await prisma.$queryRaw`
      SELECT id
      FROM monthly_plans
      WHERE TO_CHAR(start_date, 'YYYY-MM') = ${monthYear}
      LIMIT 1
    `;

    if (existingPlan) {
      return NextResponse.json(
        { error: `A plan for ${new Date(startDate).toLocaleString(undefined, { month: "long", year: "numeric" })} already exists` },
        { status: 409 }
      );
    }

    await prisma.$executeRaw`
      INSERT INTO monthly_plans (name, start_date, end_date, image_urls, created_by)
      VALUES (${name}, ${startDate}::date, ${endDate}::date, ${imageUrls}::text[], ${session.user.id}::uuid)
    `;

    return NextResponse.json({ success: true }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
