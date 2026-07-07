import { NextResponse } from "next/server";

function getAllowedHost() {
  try {
    return new URL(process.env.SUPABASE_URL || "").host;
  } catch {
    return "";
  }
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const sourceUrl = String(searchParams.get("url") || "").trim();

  if (!sourceUrl) {
    return new NextResponse("Missing file URL.", { status: 400 });
  }

  let parsedUrl;
  try {
    parsedUrl = new URL(sourceUrl);
  } catch {
    return new NextResponse("Invalid file URL.", { status: 400 });
  }

  const allowedHost = getAllowedHost();
  if (!allowedHost || parsedUrl.host !== allowedHost) {
    return new NextResponse("Forbidden file host.", { status: 403 });
  }

  const upstream = await fetch(parsedUrl.toString(), { cache: "no-store" });
  if (!upstream.ok || !upstream.body) {
    return new NextResponse("Unable to load file.", { status: upstream.status || 502 });
  }

  const headers = new Headers();
  const contentType = upstream.headers.get("content-type") || "application/octet-stream";
  headers.set("content-type", contentType);
  headers.set("content-disposition", "inline");
  headers.set("cache-control", "private, no-store, max-age=0");

  return new NextResponse(upstream.body, {
    status: 200,
    headers,
  });
}
