import { NextResponse } from "next/server";
import { requireRole, roleGuardResponse } from "@/lib/roleGuard";
import { STORAGE_SAFE_UPLOAD_MAX_BYTES, formatUploadLimit } from "@/lib/uploadLimits";

const ALLOWED_ROLES = ["student"];

function sanitizeFilename(filename) {
  return String(filename || "homework")
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .replace(/_+/g, "_");
}

function getRequiredEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing environment variable: ${name}`);
  }
  return value;
}

function json(message, status = 200, extra = {}) {
  return NextResponse.json({ message, ...extra }, { status });
}

export async function POST(request) {
  try {
    await requireRole(ALLOWED_ROLES);

    const body = await request.json().catch(() => ({}));
    const homeworkId = sanitizeFilename(body?.homeworkId || "homework");
    const fileName = sanitizeFilename(body?.fileName || "homework");
    const contentType = String(body?.contentType || "application/octet-stream").trim() || "application/octet-stream";
    const fileSize = Number(body?.fileSize || 0);

    if (fileSize > STORAGE_SAFE_UPLOAD_MAX_BYTES) {
      return json(`File is too large. Please upload a file smaller than ${formatUploadLimit()}.`, 413);
    }

    const bucket = process.env.SUPABASE_ADMISSION_DOCUMENTS_BUCKET || "ash-shajrah";
    const objectPath = `${homeworkId}/${Date.now()}_${fileName}`;
    const supabaseUrl = getRequiredEnv("SUPABASE_URL");
    const serviceRoleKey = getRequiredEnv("SUPABASE_SERVICE_ROLE_KEY");

    const response = await fetch(`${supabaseUrl}/storage/v1/object/upload/sign/${bucket}/${objectPath}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${serviceRoleKey}`,
        apikey: serviceRoleKey,
        "Content-Type": "application/json",
        "x-upsert": "false",
      },
      body: JSON.stringify({}),
      cache: "no-store",
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => "");
      throw new Error(errorText || "Unable to create homework upload URL.");
    }

    const responseData = await response.json().catch(() => ({}));
    const token = String(responseData?.token || "").trim() || (() => {
      try {
        const rawUrl = String(responseData?.signedUrl || responseData?.signedURL || responseData?.url || "").trim();
        const absoluteUrl = /^https?:\/\//i.test(rawUrl) ? rawUrl : `${supabaseUrl}${rawUrl.startsWith("/") ? "" : "/"}${rawUrl}`;
        return new URL(absoluteUrl).searchParams.get("token") || "";
      } catch {
        return "";
      }
    })();

    if (!token) {
      throw new Error("Unable to create homework upload URL.");
    }

    return json("Homework upload URL created.", 200, {
      signedUrl: `${String(supabaseUrl || "").replace(/\/+$/, "")}/storage/v1/object/upload/sign/${bucket}/${objectPath}?token=${encodeURIComponent(token)}`,
      path: `${bucket}/${objectPath}`,
      bucket,
      objectPath,
      contentType,
    });
  } catch (error) {
    const guard = roleGuardResponse(error);
    return guard || json(error instanceof Error ? error.message : "Unable to create homework upload URL.", 500);
  }
}
