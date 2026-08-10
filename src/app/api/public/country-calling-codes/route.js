import { NextResponse } from "next/server";

async function readJson(url, options = {}) {
  const response = await fetch(url, { cache: "no-store", ...options });
  const data = await response.json().catch(() => null);
  return { ok: response.ok, data };
}

function uniqueCodes(items) {
  const seen = new Set();
  const result = [];
  for (const item of items) {
    const code = String(item || "").trim();
    if (!code || seen.has(code)) continue;
    seen.add(code);
    result.push(code);
  }
  return result;
}

function normalizeCallingCode(value) {
  const digits = String(value || "").replace(/\D/g, "");
  return digits ? `+${digits}` : "";
}

export async function GET() {
  try {
    const { data } = await readJson("https://restcountries.com/v3.1/all?fields=idd");
    const rawItems = Array.isArray(data) ? data : [];
    const codes = uniqueCodes(
      rawItems.flatMap((item) => {
        const root = normalizeCallingCode(item?.idd?.root);
        const suffixes = Array.isArray(item?.idd?.suffixes) ? item.idd.suffixes : [];
        return [root, ...suffixes.map((suffix) => normalizeCallingCode(`${item?.idd?.root || ""}${suffix || ""}`))].filter(Boolean);
      })
    ).sort((left, right) => {
      const leftNum = Number(String(left).replace(/\D/g, ""));
      const rightNum = Number(String(right).replace(/\D/g, ""));
      return leftNum - rightNum || left.localeCompare(right);
    });

    return NextResponse.json({ codes }, { status: 200 });
  } catch {
    return NextResponse.json(
      {
        codes: ["+92", "+1", "+44", "+971", "+61", "+91", "+86", "+966", "+353", "+49", "+33", "+61", "+81"],
      },
      { status: 200 }
    );
  }
}
