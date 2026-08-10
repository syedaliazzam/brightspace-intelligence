import { NextResponse } from "next/server";
import { requireRole, roleGuardResponse } from "@/lib/roleGuard";

const ALLOWED_ROLES = ["coordinator", "admin", "superadmin"];

function sanitizeFilename(filename) {
  return String(filename || "file")
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

function normalizeText(value) {
  return typeof value === "string" ? value.trim() : "";
}

function json(message, status = 200, extra = {}) {
  return NextResponse.json({ message, ...extra }, { status });
}

export async function POST(request) {
  try {
    await requireRole(ALLOWED_ROLES);
    const body = await request.json();
    const fileName = sanitizeFilename(body?.fileName || "document");
    const documentType = sanitizeFilename(body?.documentType || "document");
    const contentType = String(body?.contentType || "application/octet-stream").trim() || "application/octet-stream";
    const bucket = process.env.SUPABASE_ADMISSION_DOCUMENTS_BUCKET || "ash-shajrah";
    const objectPath = `educational-document/${documentType}/${Date.now()}_${fileName}`;
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
      const errorText = await response.text();
      throw new Error(`Unable to create upload URL: ${errorText}`);
    }

    const responseData = await response.json();
    const token = String(responseData?.token || "").trim() || (() => {
      try {
        const rawUrl = String(responseData?.signedUrl || responseData?.signedURL || responseData?.url || "").trim();
        const absoluteUrl = /^https?:\/\//i.test(rawUrl) ? rawUrl : `${supabaseUrl}${rawUrl.startsWith("/") ? "" : "/"}${rawUrl}`;
        return new URL(absoluteUrl).searchParams.get("token") || "";
      } catch {
        return "";
      }
    })();
    const signedUrl = `${String(supabaseUrl || "").replace(/\/+$/, "")}/storage/v1/object/upload/sign/${bucket}/${objectPath}?token=${encodeURIComponent(token)}`;
    if (!signedUrl || !token) {
      throw new Error("Unable to create signed upload URL.");
    }

    return json("Educational document upload URL created.", 200, {
      signedUrl,
      token,
      path: `${bucket}/${objectPath}`,
      contentType,
      documentType: normalizeText(body?.documentType),
    });
  } catch (error) {
    const guard = roleGuardResponse(error);
    if (guard) return guard;
    return json(error instanceof Error ? error.message : "Unable to create upload URL.", 500);
  }
}
