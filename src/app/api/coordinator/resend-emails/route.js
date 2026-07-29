import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";

const ALLOWED_ROLES = new Set(["coordinator", "admin", "superadmin"]);
const RESEND_API_BASE_URL = process.env.RESEND_API_BASE_URL || "https://api.resend.com";

function json(message, status = 200, extra = {}) {
  return NextResponse.json({ message, ...extra }, { status });
}

export async function GET() {
  const session = await auth();
  const role = String(session?.user?.role || "").toLowerCase();

  if (!session?.user) return json("Unauthorized.", 401);
  if (!ALLOWED_ROLES.has(role)) return json("Forbidden.", 403);

  const apiKey = String(process.env.RESEND_API_KEY || "").trim();
  if (!apiKey) {
    return json("RESEND_API_KEY is not configured in env.", 400, { items: [] });
  }

  try {
    const response = await fetch(`${RESEND_API_BASE_URL}/emails?limit=100`, {
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
        data?.message || data?.error?.message || "Unable to fetch sent emails from Resend.",
        response.status,
        { items: [] }
      );
    }

    const items = Array.isArray(data?.data)
      ? data.data.map((item) => ({
          id: String(item?.id || ""),
          to: Array.isArray(item?.to) ? item.to : [],
          from: String(item?.from || ""),
          subject: String(item?.subject || ""),
          created_at: item?.created_at || null,
          last_event: String(item?.last_event || "pending"),
          scheduled_at: item?.scheduled_at || null,
          cc: Array.isArray(item?.cc) ? item.cc : [],
          bcc: Array.isArray(item?.bcc) ? item.bcc : [],
          reply_to: Array.isArray(item?.reply_to) ? item.reply_to : [],
        }))
      : [];

    return json("Resend sent emails fetched.", 200, {
      items,
      has_more: Boolean(data?.has_more),
    });
  } catch (error) {
    return json(error instanceof Error ? error.message : "Unable to fetch sent emails from Resend.", 500, { items: [] });
  }
}


