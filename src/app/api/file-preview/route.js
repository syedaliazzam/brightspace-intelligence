import { NextResponse } from "next/server";
import { createSignedAdmissionDocumentUrl } from "@/lib/supabaseStorage";

function getAllowedHost() {
  try {
    return new URL(process.env.SUPABASE_URL || "").host;
  } catch {
    return "";
  }
}

function redirectToFile(url) {
  const response = NextResponse.redirect(url);
  response.headers.set("cache-control", "private, no-store, max-age=0");
  return response;
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

    return redirectToFile(signedUrl);
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

  return redirectToFile(parsedUrl.toString());
}
