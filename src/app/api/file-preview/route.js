import { NextResponse } from "next/server";
import { createSignedAdmissionDocumentUrl } from "@/lib/supabaseStorage";

function getAllowedHost() {
  try {
    return new URL(process.env.SUPABASE_URL || "").host;
  } catch {
    return "";
  }
}

function shouldBypassDataCache(value = "") {
  return /\.(mp4|webm|ogg|mov|m4v|avi|mkv)(\?.*)?$/i.test(String(value || ""));
}

function buildResponseHeaders(upstream, bypassDataCache = false) {
  const headers = new Headers();
  const contentType = upstream.headers.get("content-type") || "application/octet-stream";
  headers.set("content-type", contentType);
  headers.set("content-disposition", "inline");
  headers.set(
    "cache-control",
    bypassDataCache ? "private, no-store, max-age=0" : "private, max-age=300, stale-while-revalidate=300"
  );
  return headers;
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const sourceUrl = String(searchParams.get("url") || "").trim();
  const storedPath = String(searchParams.get("path") || "").trim();

  if (storedPath) {
    const signedUrl = await createSignedAdmissionDocumentUrl(storedPath).catch(() => "");
    if (!signedUrl) {
      return new NextResponse("Unable to load file.", { status: 502 });
    }

    const bypassDataCache = shouldBypassDataCache(storedPath);
    const upstream = await fetch(signedUrl, { cache: "no-store" });
    if (!upstream.ok || !upstream.body) {
      return new NextResponse("Unable to load file.", { status: upstream.status || 502 });
    }

    const headers = buildResponseHeaders(upstream, bypassDataCache);

    return new NextResponse(upstream.body, {
      status: 200,
      headers,
    });
  }

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

  const bypassDataCache = shouldBypassDataCache(parsedUrl.pathname);
  const upstream = await fetch(parsedUrl.toString(), { cache: "no-store" });
  if (!upstream.ok || !upstream.body) {
    return new NextResponse("Unable to load file.", { status: upstream.status || 502 });
  }

  const headers = buildResponseHeaders(upstream, bypassDataCache);

  return new NextResponse(upstream.body, {
    status: 200,
    headers,
  });
}
