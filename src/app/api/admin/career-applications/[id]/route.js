import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";

const ALLOWED_ROLES = new Set(["superadmin", "admin", "coordinator"]);

function json(message, status = 200, extra = {}) {
  return NextResponse.json({ message, ...extra }, { status });
}

function normalizeText(value) {
  return typeof value === "string" ? value.trim() : "";
}

export async function PATCH(request, { params }) {
  const session = await auth();
  const role = String(session?.user?.role || "").toLowerCase();

  if (!session?.user) return json("Unauthorized.", 401);
  if (!ALLOWED_ROLES.has(role)) return json("Forbidden.", 403);

  const { id } = await params;
  const contentType = request.headers.get("content-type") || "";
  let body = {};
  let resumeFile = null;

  if (contentType.includes("multipart/form-data")) {
    const formData = await request.formData();
    body = Object.fromEntries(formData.entries());
    const uploadedResume = formData.get("resume");
    resumeFile = uploadedResume instanceof File && uploadedResume.size > 0 ? uploadedResume : null;
  } else {
    body = await request.json();
  }

  const fullName = normalizeText(body?.full_name || body?.fullName);
  const email = normalizeText(body?.email);
  const whatsapp = normalizeText(body?.whatsapp);
  const interestedRole = normalizeText(body?.interested_role || body?.interestedRole);
  const source = normalizeText(body?.source);
  const message = normalizeText(body?.message);
  const adminNotes = normalizeText(body?.admin_notes || body?.adminNotes);

  if (!fullName || !email || !whatsapp || !interestedRole) {
    return json("Name, email, WhatsApp, and interested role are required.", 400);
  }

  try {
    const resumeBuffer = resumeFile ? Buffer.from(await resumeFile.arrayBuffer()) : null;
    const rows = resumeFile
      ? await prisma.$queryRaw`
        UPDATE career_applications
        SET full_name = ${fullName},
            email = ${email},
            whatsapp = ${whatsapp},
            interested_role = ${interestedRole},
            source = ${source || null},
            message = ${message || null},
            admin_notes = ${adminNotes || null},
            resume_file_name = ${resumeFile.name},
            resume_mime_type = ${resumeFile.type || "application/octet-stream"},
            resume_size_bytes = ${resumeFile.size},
            resume_file_data = ${resumeBuffer},
            updated_at = NOW()
        WHERE id = ${id}
        RETURNING
          id::text AS id,
          full_name,
          email,
          whatsapp,
          interested_role,
          message,
          resume_file_name,
          resume_mime_type,
          resume_size_bytes,
          source,
          LOWER(status::text) AS status,
          admin_notes,
          submitted_at,
          updated_at
      `
      : await prisma.$queryRaw`
        UPDATE career_applications
        SET full_name = ${fullName},
            email = ${email},
            whatsapp = ${whatsapp},
            interested_role = ${interestedRole},
            source = ${source || null},
            message = ${message || null},
            admin_notes = ${adminNotes || null},
            updated_at = NOW()
        WHERE id = ${id}
        RETURNING
          id::text AS id,
          full_name,
          email,
          whatsapp,
          interested_role,
          message,
          resume_file_name,
          resume_mime_type,
          resume_size_bytes,
          source,
          LOWER(status::text) AS status,
          admin_notes,
          submitted_at,
          updated_at
      `;

    if (!rows?.[0]) {
      return json("Career application not found.", 404);
    }

    return json("Career application updated.", 200, { item: rows[0] });
  } catch (error) {
    return json(error instanceof Error ? error.message : "Unable to update career application.", 500);
  }
}

export async function DELETE(_request, { params }) {
  const session = await auth();
  const role = String(session?.user?.role || "").toLowerCase();

  if (!session?.user) return json("Unauthorized.", 401);
  if (!ALLOWED_ROLES.has(role)) return json("Forbidden.", 403);

  const { id } = await params;

  try {
    const result = await prisma.$executeRaw`
      DELETE FROM career_applications
      WHERE id = ${id}
    `;

    if (!result) {
      return json("Career application not found.", 404);
    }

    return json("Career application deleted.", 200);
  } catch (error) {
    return json(error instanceof Error ? error.message : "Unable to delete career application.", 500);
  }
}
