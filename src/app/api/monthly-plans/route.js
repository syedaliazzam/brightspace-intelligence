import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { uploadAdmissionDocument } from "@/lib/supabaseStorage";

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
    const contentType = String(request.headers.get("content-type") || "").toLowerCase();
    const body = contentType.includes("multipart/form-data") ? await request.formData() : await request.json();
    const name = contentType.includes("multipart/form-data") ? String(body.get("name") || "").trim() : String(body?.name || "").trim();
    const startDate = contentType.includes("multipart/form-data") ? String(body.get("startDate") || "").trim() : String(body?.startDate || "").trim();
    const endDate = contentType.includes("multipart/form-data") ? String(body.get("endDate") || "").trim() : String(body?.endDate || "").trim();
    const fileValues = contentType.includes("multipart/form-data") ? body.getAll("files") : [];

    if (!name || !startDate || !endDate) {
      return NextResponse.json({ error: "Name, start date, and end date are required" }, { status: 400 });
    }

    const files = Array.isArray(fileValues) ? fileValues.filter((value) => value instanceof File && value.size) : [];

    // Check if a plan already exists for the same month using an index-friendly range query.
    const startDateObj = new Date(startDate);
    const monthStart = new Date(startDateObj.getFullYear(), startDateObj.getMonth(), 1);
    const monthEnd = new Date(startDateObj.getFullYear(), startDateObj.getMonth() + 1, 1);

    const [existingPlan] = await prisma.$queryRaw`
      SELECT id
      FROM monthly_plans
      WHERE start_date >= ${monthStart}::date
        AND start_date < ${monthEnd}::date
      LIMIT 1
    `;

    if (existingPlan) {
      return NextResponse.json(
        { error: `A plan for ${new Date(startDate).toLocaleString(undefined, { month: "long", year: "numeric" })} already exists` },
        { status: 409 }
      );
    }

    let imageUrls = [];
    if (files.length) {
      for (const file of files) {
        const upload = await uploadAdmissionDocument({
          applicationId: "monthly-plan",
          documentType: "monthly_plan",
          file,
        });
        imageUrls.push(upload.storedPath);
      }
    } else if (!contentType.includes("multipart/form-data")) {
      imageUrls = Array.isArray(body?.imageUrls) ? body.imageUrls.filter(Boolean) : [];
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
