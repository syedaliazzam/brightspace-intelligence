import crypto from "crypto";

const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_SHEETS_BASE_URL = "https://sheets.googleapis.com/v4/spreadsheets";
const SHEET_NAME = "LMS Student Registration Leads";
const SHEET_HEADERS = [
  "google_sheet_row_id",
  "submitted_at",
  "student_name",
  "parent_name",
  "parent_relation",
  "email",
  "phone",
  "student_age",
  "class_level",
  "subject_interest",
  "preferred_schedule",
  "address",
  "city",
  "notes",
  "source",
  "status",
  "synced_to_database",
  "database_registration_id",
  "last_synced_at",
  "sync_error",
];

function getRequiredEnv(name) {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Missing environment variable: ${name}`);
  }

  return value;
}

function getOptionalEnv(name) {
  return process.env[name] || undefined;
}

function base64UrlEncode(value) {
  return Buffer.from(value)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

async function getGoogleAccessToken() {
  const clientEmail = getOptionalEnv("GOOGLE_SERVICE_ACCOUNT_EMAIL");
  const privateKey = getOptionalEnv("GOOGLE_PRIVATE_KEY");

  if (!clientEmail || !privateKey) {
    throw new Error(
      "Google service account auth is unavailable. Use public sheet sync or set GOOGLE_SERVICE_ACCOUNT_EMAIL and GOOGLE_PRIVATE_KEY."
    );
  }

  const privateKeyValue = privateKey.replace(/\\n/g, "\n");
  const now = Math.floor(Date.now() / 1000);

  const header = { alg: "RS256", typ: "JWT" };
  const payload = {
    iss: clientEmail,
    scope: "https://www.googleapis.com/auth/spreadsheets",
    aud: GOOGLE_TOKEN_URL,
    exp: now + 3600,
    iat: now,
  };

  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const unsignedToken = `${encodedHeader}.${encodedPayload}`;
  const signer = crypto.createSign("RSA-SHA256");

  signer.update(unsignedToken);
  signer.end();

  const signature = signer
    .sign(privateKeyValue)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");

  const assertion = `${unsignedToken}.${signature}`;
  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
    cache: "no-store",
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Google auth failed: ${errorText}`);
  }

  const data = await response.json();
  return data.access_token;
}

async function googleSheetsRequest(path, options = {}) {
  const spreadsheetId = getRequiredEnv("GOOGLE_SHEETS_SPREADSHEET_ID");
  const accessToken = await getGoogleAccessToken();
  const response = await fetch(`${GOOGLE_SHEETS_BASE_URL}/${spreadsheetId}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
    cache: "no-store",
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Google Sheets request failed: ${errorText}`);
  }

  if (response.status === 204) {
    return null;
  }

  return response.json();
}

function mapRowToLead(row, rowNumber, headerIndex) {
  const lead = {
    rowNumber,
  };

  for (const header of SHEET_HEADERS) {
    const index = headerIndex[header];
    lead[header] = index === undefined ? "" : String(row[index] || "").trim();
  }

  return lead;
}

export async function readRegistrationLeadRows() {
  const encodedRange = encodeURIComponent(`${SHEET_NAME}!A:T`);
  const data = await googleSheetsRequest(`/values/${encodedRange}`);
  const values = data?.values || [];

  if (!values.length) {
    return [];
  }

  const headers = values[0];
  const headerIndex = headers.reduce((accumulator, header, index) => {
    accumulator[String(header || "").trim()] = index;
    return accumulator;
  }, {});

  return values.slice(1).map((row, index) => mapRowToLead(row, index + 2, headerIndex));
}

export async function updateRegistrationLeadSyncTracking(rows) {
  if (!rows.length) {
    return;
  }

  const data = rows.map((row) => ({
    range: `${SHEET_NAME}!Q${row.rowNumber}:T${row.rowNumber}`,
    values: [[
      row.syncedToDatabase ? "yes" : "no",
      row.databaseRegistrationId || "",
      row.lastSyncedAt || "",
      row.syncError || "",
    ]],
  }));

  await googleSheetsRequest("/values:batchUpdate", {
    method: "POST",
    body: JSON.stringify({
      valueInputOption: "USER_ENTERED",
      data,
    }),
  });
}

export { SHEET_HEADERS, SHEET_NAME };
