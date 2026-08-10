import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";

const ALLOWED_ROLES = new Set(["coordinator", "admin", "superadmin"]);
const RESEND_API_BASE_URL = process.env.RESEND_API_BASE_URL || "https://api.resend.com";

function json(message, status = 200, extra = {}) {
  return NextResponse.json({ message, ...extra }, { status });
}

function buildDedupKey(item) {
  const to = Array.isArray(item?.to)
    ? item.to.map((value) => String(value || "").trim().toLowerCase()).sort().join("|")
    : "";
  const from = String(item?.from || "").trim().toLowerCase();
  const subject = String(item?.subject || "").trim().toLowerCase();
  const createdAt = String(item?.created_at || "").trim();
  return [to, from, subject, createdAt].join("::");
}

async function fetchAllSentEmails(apiKey) {
  const items = [];
  let after = "";

  while (true) {
    const url = new URL(`${RESEND_API_BASE_URL}/emails`);
    url.searchParams.set("limit", "100");
    if (after) url.searchParams.set("after", after);

    const response = await fetch(url.toString(), {
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
      return { error: data?.message || data?.error?.message || "Unable to fetch sent emails from Resend." };
    }

    const pageItems = Array.isArray(data?.data) ? data.data : [];
    items.push(...pageItems);

    if (!data?.has_more || pageItems.length === 0) {
      break;
    }

    after = String(pageItems[pageItems.length - 1]?.id || "");
    if (!after) break;
  }

  return { items };
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
    const result = await fetchAllSentEmails(apiKey);
    if (result.error) {
      return json(result.error, 500, { items: [] });
    }

    const rawItems = Array.isArray(result.items)
      ? result.items.map((item) => ({
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

    const seen = new Set();
    const items = rawItems.filter((item) => {
      const key = item.id || buildDedupKey(item);
      if (!key) return true;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    return json("Resend sent emails fetched.", 200, {
      items,
      has_more: false,
    });
  } catch (error) {
    return json(error instanceof Error ? error.message : "Unable to fetch sent emails from Resend.", 500, { items: [] });
  }
}


