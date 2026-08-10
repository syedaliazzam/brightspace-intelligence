import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { uploadAdmissionDocument } from "@/lib/supabaseStorage";

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
    const contentType = String(request.headers.get("content-type") || "").toLowerCase();
    const body = contentType.includes("multipart/form-data") ? await request.formData() : await request.json();
    const name = contentType.includes("multipart/form-data") ? String(body.get("name") || "").trim() : String(body?.name || "").trim();
    const startDate = contentType.includes("multipart/form-data") ? String(body.get("startDate") || "").trim() : String(body?.startDate || "").trim();
    const endDate = contentType.includes("multipart/form-data") ? String(body.get("endDate") || "").trim() : String(body?.endDate || "").trim();
    const imageUrls = contentType.includes("multipart/form-data")
      ? body.getAll("imageUrls").map((value) => String(value || "").trim()).filter(Boolean)
      : Array.isArray(body?.imageUrls) ? body.imageUrls : [];
    const fileValues = contentType.includes("multipart/form-data") ? body.getAll("files") : [];
    const files = Array.isArray(fileValues) ? fileValues.filter((value) => value instanceof File && value.size) : [];

    const uploadedPaths = [];
    for (const file of files) {
      const upload = await uploadAdmissionDocument({
        applicationId: id,
        documentType: "monthly_plan",
        file,
      });
      uploadedPaths.push(upload.storedPath);
    }

    const finalImageUrls = [...imageUrls, ...uploadedPaths];

    await prisma.$executeRaw`
      UPDATE monthly_plans
      SET name = ${name}, start_date = ${startDate}::date, end_date = ${endDate}::date, image_urls = ${finalImageUrls}::text[]
      WHERE id = ${id}::uuid
    `;

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
