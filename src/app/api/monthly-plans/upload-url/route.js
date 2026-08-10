import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";

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

function buildAbsoluteUrl(baseUrl, pathOrUrl) {
  const value = String(pathOrUrl || "").trim();
  if (!value) return "";
  if (/^https?:\/\//i.test(value)) return value;
  const normalizedBase = String(baseUrl || "").replace(/\/+$/, "");
  const normalizedValue = value.replace(/^\/+/, "");
  if (normalizedValue.startsWith("object/")) {
    return `${normalizedBase}/storage/v1/${normalizedValue}`;
  }
  return `${normalizedBase}/${normalizedValue}`;
}

export async function POST(request) {
  const session = await auth();
  const role = String(session?.user?.role || "").toLowerCase();
  if (!["coordinator", "admin", "superadmin"].includes(role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = await request.json();
    const fileName = sanitizeFilename(body?.fileName || "plan-file");
    const contentType = String(body?.contentType || "application/octet-stream").trim() || "application/octet-stream";
    const bucket = process.env.SUPABASE_ADMISSION_DOCUMENTS_BUCKET || "ash-shajrah";
    const objectPath = `monthly_plan/${Date.now()}_${fileName}`;
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
    const signedUrl = buildAbsoluteUrl(supabaseUrl, responseData?.signedUrl || responseData?.signedURL || responseData?.url);
    const token = String(responseData?.token || "").trim() || (() => {
      try {
        return new URL(signedUrl).searchParams.get("token") || "";
      } catch {
        return "";
      }
    })();
    if (!signedUrl || !token) {
      throw new Error("Unable to create signed upload URL.");
    }

    return NextResponse.json(
      {
        signedUrl,
        token,
        path: `${bucket}/${objectPath}`,
        contentType,
      },
      { status: 200 }
    );
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to create upload URL." }, { status: 500 });
  }
}
