import crypto from "crypto";

const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_CALENDAR_BASE_URL = "https://www.googleapis.com/calendar/v3";

function getRequiredEnv(name) {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Missing environment variable: ${name}`);
  }

  return value;
}

function getCalendarId() {
  return process.env.GOOGLE_CALENDAR_ID || process.env.GOOGLE_SERVICE_CALENDAR_ID || "primary";
}

function base64UrlEncode(value) {
  return Buffer.from(value)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

async function getGoogleAccessToken() {
  const clientEmail = getRequiredEnv("GOOGLE_SERVICE_ACCOUNT_EMAIL");
  const privateKey = getRequiredEnv("GOOGLE_PRIVATE_KEY").replace(/\\n/g, "\n");
  const now = Math.floor(Date.now() / 1000);

  const header = { alg: "RS256", typ: "JWT" };
  const payload = {
    iss: clientEmail,
    scope: "https://www.googleapis.com/auth/calendar.events",
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
    .sign(privateKey)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");

  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: `${unsignedToken}.${signature}`,
    }),
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Google auth failed: ${await response.text()}`);
  }

  const data = await response.json();
  return data.access_token;
}

async function calendarRequest(path, options = {}) {
  const accessToken = await getGoogleAccessToken();
  const response = await fetch(`${GOOGLE_CALENDAR_BASE_URL}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Google Calendar request failed: ${await response.text()}`);
  }

  if (response.status === 204) {
    return null;
  }

  return response.json();
}

function buildEventPayload(payload, includeConferenceData = true) {
  const attendees = Array.isArray(payload?.attendees)
    ? payload.attendees
        .filter((item) => item?.email)
        .map((item) => ({ email: item.email, displayName: item.name || undefined }))
    : [];

  return {
    summary: payload.title,
    description: payload.description || "",
    start: { dateTime: payload.start, timeZone: payload.timeZone || "Asia/Karachi" },
    end: { dateTime: payload.end, timeZone: payload.timeZone || "Asia/Karachi" },
    attendees,
    conferenceData: includeConferenceData
      ? {
          createRequest: {
            requestId: crypto.randomUUID(),
            conferenceSolutionKey: { type: "hangoutsMeet" },
          },
        }
      : undefined,
  };
}

export async function createCalendarLectureEvent(payload) {
  const calendarId = encodeURIComponent(getCalendarId());
  const data = await calendarRequest(
    `/calendars/${calendarId}/events?conferenceDataVersion=1&sendUpdates=none`,
    {
      method: "POST",
      body: JSON.stringify(buildEventPayload(payload, true)),
    }
  );

  return {
    eventId: data?.id || "",
    meetLink: data?.hangoutLink || data?.conferenceData?.entryPoints?.[0]?.uri || "",
    meetSpaceId: data?.conferenceData?.conferenceId || "",
    eventHtmlLink: data?.htmlLink || "",
  };
}

export async function updateCalendarLectureEvent(eventId, payload) {
  if (!eventId) {
    return null;
  }

  const calendarId = encodeURIComponent(getCalendarId());
  const data = await calendarRequest(
    `/calendars/${calendarId}/events/${encodeURIComponent(eventId)}?conferenceDataVersion=1&sendUpdates=none`,
    {
      method: "PATCH",
      body: JSON.stringify(buildEventPayload(payload, false)),
    }
  );

  return {
    eventId: data?.id || eventId,
    meetLink: data?.hangoutLink || data?.conferenceData?.entryPoints?.[0]?.uri || "",
    meetSpaceId: data?.conferenceData?.conferenceId || "",
    eventHtmlLink: data?.htmlLink || "",
  };
}

export async function cancelCalendarLectureEvent(eventId) {
  if (!eventId) {
    return null;
  }

  const calendarId = encodeURIComponent(getCalendarId());

  return calendarRequest(`/calendars/${calendarId}/events/${encodeURIComponent(eventId)}`, {
    method: "DELETE",
  });
}

