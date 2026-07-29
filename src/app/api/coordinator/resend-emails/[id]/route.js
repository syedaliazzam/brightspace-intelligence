import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";

const ALLOWED_ROLES = new Set(["coordinator", "admin", "superadmin"]);
const RESEND_API_BASE_URL = process.env.RESEND_API_BASE_URL || "https://api.resend.com";

function json(message, status = 200, extra = {}) {
  return NextResponse.json({ message, ...extra }, { status });
}

export async function GET(_request, context) {
  const session = await auth();
  const role = String(session?.user?.role || "").toLowerCase();

  if (!session?.user) return json("Unauthorized.", 401);
  if (!ALLOWED_ROLES.has(role)) return json("Forbidden.", 403);

  const apiKey = String(process.env.RESEND_API_KEY || "").trim();
  if (!apiKey) {
    return json("RESEND_API_KEY is not configured in env.", 400);
  }

  const params = await context?.params;
  const id = String(params?.id || "").trim();
  if (!id) return json("Email id is required.", 400);

  try {
    const response = await fetch(`${RESEND_API_BASE_URL}/emails/${encodeURIComponent(id)}`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "User-Agent": "ALH-LMS/1.0",
      },
      cache: "no-store",
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      return json(
        data?.message || data?.error?.message || "Unable to fetch email content from Resend.",
        response.status
      );
    }

    return json("Resend email content fetched.", 200, {
      item: {
        id: String(data?.id || id),
        subject: String(data?.subject || ""),
        html: String(data?.html || ""),
        text: String(data?.text || ""),
        last_event: String(data?.last_event || "pending"),
        created_at: data?.created_at || null,
        from: String(data?.from || ""),
        to: Array.isArray(data?.to) ? data.to : [],
      },
    });
  } catch (error) {
    return json(error instanceof Error ? error.message : "Unable to fetch email content from Resend.", 500);
  }
}

