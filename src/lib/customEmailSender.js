import net from "node:net";
import tls from "node:tls";

function stripHtml(value) {
  return String(value || "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeLineEndings(value) {
  return String(value || "").replace(/\r?\n/g, "\r\n");
}

function encodeBase64(value) {
  return Buffer.from(String(value || ""), "utf8").toString("base64");
}

function encodeBase64Lines(buffer) {
  return Buffer.from(buffer).toString("base64").replace(/.{1,76}/g, "$&\r\n").trim();
}

function readSmtpResponse(socket) {
  return new Promise((resolve, reject) => {
    let buffer = "";

    const onData = (chunk) => {
      buffer += chunk.toString("utf8");
      const lines = buffer.split("\r\n");
      const lastLine = lines[lines.length - 1];
      const completeLines = lines.slice(0, -1).filter(Boolean);
      const pendingLine = completeLines.at(-1) || lastLine || "";
      const match = pendingLine.match(/^(\d{3})([ -])/);

      if (!match) return;

      const code = Number(match[1]);
      const isFinal = match[2] === " ";
      if (!isFinal) return;

      socket.off("data", onData);
      socket.off("error", onError);
      resolve({ code, message: buffer.trim() });
    };

    const onError = (error) => {
      socket.off("data", onData);
      socket.off("error", onError);
      reject(error);
    };

    socket.on("data", onData);
    socket.on("error", onError);
  });
}

async function writeCommand(socket, command) {
  socket.write(`${command}\r\n`);
  return readSmtpResponse(socket);
}

function awaitSocketReady(socket, eventName) {
  return new Promise((resolve, reject) => {
    socket.once("error", reject);
    socket.once(eventName, resolve);
  });
}

function buildMessage({ to, subject, html, text, attachments = [] }) {
  const fromAddress = process.env.SMTP_EMAIL || process.env.SMTP_USER;
  const fromName = process.env.SMTP_FROM_NAME || "LMS Platform";
  const sender = `"${fromName.replace(/"/g, '\\"')}" <${fromAddress}>`;
  const subjectLine = String(subject || "").replace(/\r?\n/g, " ").trim();
  const bodyText = text || stripHtml(html);
  const alternativeBoundary = `custom_alt_${Date.now()}`;
  const mixedBoundary = `custom_mix_${Date.now()}`;
  const safeAttachments = Array.isArray(attachments) ? attachments.filter((attachment) => attachment?.content) : [];
  const parts = [
    `From: ${sender}`,
    `To: ${String(to || "").trim()}`,
    `Subject: ${subjectLine}`,
    "MIME-Version: 1.0",
  ];

  if (safeAttachments.length) {
    parts.push(
      `Content-Type: multipart/mixed; boundary="${mixedBoundary}"`,
      "",
      `--${mixedBoundary}`,
      `Content-Type: multipart/alternative; boundary="${alternativeBoundary}"`
    );
  } else {
    parts.push(`Content-Type: multipart/alternative; boundary="${alternativeBoundary}"`);
  }

  parts.push(
    "",
    `--${alternativeBoundary}`,
    "Content-Type: text/plain; charset=utf-8",
    "",
    bodyText,
    "",
    `--${alternativeBoundary}`,
    "Content-Type: text/html; charset=utf-8",
    "",
    html,
    "",
    `--${alternativeBoundary}--`
  );

  safeAttachments.forEach((attachment) => {
    const filename = String(attachment.filename || "attachment").replace(/"/g, "");
    parts.push(
      "",
      `--${mixedBoundary}`,
      `Content-Type: ${attachment.contentType || "application/octet-stream"}; name="${filename}"`,
      "Content-Transfer-Encoding: base64",
      `Content-Disposition: attachment; filename="${filename}"`,
      "",
      encodeBase64Lines(attachment.content)
    );
  });

  if (safeAttachments.length) {
    parts.push("", `--${mixedBoundary}--`);
  }

  parts.push("");
  return parts.join("\r\n");
}

export async function sendCustomEmail({ to, subject, html, text, attachments = [] }) {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT || 587);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const fromAddress = process.env.SMTP_EMAIL || user;
  const destination = String(to || "").trim();

  if (!destination) {
    throw new Error("Recipient email is required.");
  }

  if (!host || !user || !pass || !fromAddress) {
    throw new Error("SMTP is not configured. Set SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, and SMTP_EMAIL.");
  }

  const useTls = port === 465;
  let socket = useTls ? tls.connect({ host, port, servername: host }) : net.connect({ host, port });

  await awaitSocketReady(socket, useTls ? "secureConnect" : "connect");

  let response = await readSmtpResponse(socket);
  if (response.code !== 220) {
    socket.end();
    throw new Error(`SMTP connection failed: ${response.message}`);
  }

  response = await writeCommand(socket, `EHLO ${host}`);
  if (response.code !== 250) {
    socket.end();
    throw new Error(`SMTP EHLO failed: ${response.message}`);
  }

  if (!useTls) {
    response = await writeCommand(socket, "STARTTLS");
    if (response.code !== 220) {
      socket.end();
      throw new Error(`SMTP STARTTLS failed: ${response.message}`);
    }

    socket = tls.connect({ socket, servername: host });
    await awaitSocketReady(socket, "secureConnect");

    response = await writeCommand(socket, `EHLO ${host}`);
    if (response.code !== 250) {
      socket.end();
      throw new Error(`SMTP EHLO after STARTTLS failed: ${response.message}`);
    }
  }

  response = await writeCommand(socket, "AUTH LOGIN");
  if (response.code !== 334) {
    socket.end();
    throw new Error(`SMTP AUTH LOGIN failed: ${response.message}`);
  }

  response = await writeCommand(socket, encodeBase64(user));
  if (response.code !== 334) {
    socket.end();
    throw new Error(`SMTP username rejected: ${response.message}`);
  }

  response = await writeCommand(socket, encodeBase64(pass));
  if (response.code !== 235) {
    socket.end();
    throw new Error(`SMTP password rejected: ${response.message}`);
  }

  response = await writeCommand(socket, `MAIL FROM:<${fromAddress}>`);
  if (response.code !== 250) {
    socket.end();
    throw new Error(`SMTP MAIL FROM failed: ${response.message}`);
  }

  response = await writeCommand(socket, `RCPT TO:<${destination}>`);
  if (response.code !== 250 && response.code !== 251) {
    socket.end();
    throw new Error(`SMTP RCPT TO failed: ${response.message}`);
  }

  response = await writeCommand(socket, "DATA");
  if (response.code !== 354) {
    socket.end();
    throw new Error(`SMTP DATA failed: ${response.message}`);
  }

  const message = buildMessage({ to: destination, subject, html, text, attachments });
  socket.write(`${normalizeLineEndings(message).replace(/^\./gm, "..")}\r\n.\r\n`);
  response = await readSmtpResponse(socket);
  if (response.code !== 250) {
    socket.end();
    throw new Error(`SMTP message send failed: ${response.message}`);
  }

  await writeCommand(socket, "QUIT").catch(() => null);
  socket.end();
  return true;
}
