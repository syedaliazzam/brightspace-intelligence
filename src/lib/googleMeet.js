import crypto from "crypto";

const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_MEET_BASE_URL = "https://meet.googleapis.com/v2";

function getRequiredEnv(name) {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Missing environment variable: ${name}`);
  }

  return value;
}

function base64UrlEncode(value) {
  return Buffer.from(value)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

async function getGoogleMeetAccessToken() {
  const clientEmail = getRequiredEnv("GOOGLE_SERVICE_ACCOUNT_EMAIL");
  const privateKey = getRequiredEnv("GOOGLE_PRIVATE_KEY").replace(/\\n/g, "\n");
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "RS256", typ: "JWT" };
  const payload = {
    iss: clientEmail,
    scope: "https://www.googleapis.com/auth/meetings.space.readonly",
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
    throw new Error(`Google Meet auth failed: ${await response.text()}`);
  }

  const data = await response.json();
  return data.access_token;
}

async function meetRequest(path) {
  const accessToken = await getGoogleMeetAccessToken();
  const response = await fetch(`${GOOGLE_MEET_BASE_URL}${path}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Google Meet request failed: ${await response.text()}`);
  }

  return response.json();
}

function getParticipantEmail(participant) {
  return (
    participant?.signedinUser?.email ||
    participant?.signedInUser?.email ||
    participant?.anonymousUser?.email ||
    participant?.phoneUser?.phoneNumber ||
    ""
  ).toLowerCase();
}

function getParticipantName(participant) {
  return (
    participant?.signedinUser?.displayName ||
    participant?.signedInUser?.displayName ||
    participant?.anonymousUser?.displayName ||
    participant?.phoneUser?.displayName ||
    ""
  );
}

function durationMinutes(start, end) {
  const startedAt = new Date(start);
  const endedAt = new Date(end || Date.now());

  if (Number.isNaN(startedAt.getTime()) || Number.isNaN(endedAt.getTime())) {
    return 0;
  }

  return Math.max(0, Math.round((endedAt.getTime() - startedAt.getTime()) / 60000));
}

function aggregateRecords(records) {
  const grouped = new Map();

  for (const record of records) {
    const key = record.participantEmail || record.googleParticipantId || record.participantName;
    const existing = grouped.get(key);

    if (!existing) {
      grouped.set(key, { ...record, raw: [record.raw] });
      continue;
    }

    const existingJoined = existing.joinedAt ? new Date(existing.joinedAt).getTime() : Number.POSITIVE_INFINITY;
    const nextJoined = record.joinedAt ? new Date(record.joinedAt).getTime() : Number.POSITIVE_INFINITY;
    const existingLeft = existing.leftAt ? new Date(existing.leftAt).getTime() : 0;
    const nextLeft = record.leftAt ? new Date(record.leftAt).getTime() : 0;

    existing.joinedAt = nextJoined < existingJoined ? record.joinedAt : existing.joinedAt;
    existing.leftAt = nextLeft > existingLeft ? record.leftAt : existing.leftAt;
    existing.durationMinutes = Number(existing.durationMinutes || 0) + Number(record.durationMinutes || 0);
    existing.raw.push(record.raw);
  }

  return [...grouped.values()];
}

export async function getMeetAttendanceRecords({ meetSpaceId }) {
  if (!meetSpaceId) {
    return { available: false, records: [], conferenceRecord: null };
  }

  const filter = encodeURIComponent(`space.meeting_code = "${meetSpaceId}"`);
  const conferences = await meetRequest(`/conferenceRecords?filter=${filter}`);
  const conferenceRecord = conferences?.conferenceRecords?.[0];

  if (!conferenceRecord?.name) {
    return { available: false, records: [], conferenceRecord: null };
  }

  const participantsPayload = await meetRequest(`/${conferenceRecord.name}/participants`);
  const participants = participantsPayload?.participants || [];
  const records = [];

  for (const participant of participants) {
    const sessionsPayload = await meetRequest(`/${participant.name}/participantSessions`);
    const sessions = sessionsPayload?.participantSessions || [];

    for (const session of sessions) {
      records.push({
        participantEmail: getParticipantEmail(participant),
        participantName: getParticipantName(participant),
        googleParticipantId: participant.name || "",
        googleSessionId: session.name || "",
        joinedAt: session.startTime || null,
        leftAt: session.endTime || null,
        durationMinutes: durationMinutes(session.startTime, session.endTime),
        raw: { participant, session },
      });
    }
  }

  return { available: true, records: aggregateRecords(records), conferenceRecord };
}
