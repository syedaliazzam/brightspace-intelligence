function getBaseUrl() {
  return process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || "";
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatDate(value) {
  if (!value) {
    return "";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
  }).format(date);
}

export function buildFeeVoucherEmailHtml({
  studentName,
  voucherNo,
  amount,
  dueDate,
  portalUrl,
}) {
  const safeStudentName = escapeHtml(studentName);
  const safeVoucherNo = escapeHtml(voucherNo);
  const safeAmount = escapeHtml(amount);
  const safeDueDate = escapeHtml(formatDate(dueDate));
  const safePortalUrl = escapeHtml(portalUrl);

  return `
    <div style="margin:0;padding:0;background:#f8fafc;font-family:Arial,sans-serif;color:#0f172a;">
      <div style="max-width:640px;margin:0 auto;padding:32px 20px;">
        <div style="background:#ffffff;border:1px solid #e2e8f0;border-radius:24px;overflow:hidden;box-shadow:0 18px 60px rgba(15,23,42,.08);">
          <div style="padding:28px 28px 18px;background:linear-gradient(135deg,#0f172a,#1e293b);color:#ffffff;">
            <p style="margin:0 0 8px;font-size:12px;letter-spacing:.18em;text-transform:uppercase;opacity:.8;">LMS Voucher Ready</p>
            <h1 style="margin:0;font-size:28px;line-height:1.2;">Your fee voucher is available</h1>
          </div>
          <div style="padding:28px;">
            <p style="margin:0 0 18px;font-size:15px;line-height:1.7;color:#334155;">Hello, <strong>${safeStudentName}</strong>.</p>
            <p style="margin:0 0 22px;font-size:15px;line-height:1.7;color:#334155;">Your fee voucher has been created and is ready for review. Please use the secure portal link below to view the invoice and upload payment proof when you are ready.</p>

            <div style="border:1px solid #e2e8f0;border-radius:18px;padding:18px;background:#f8fafc;">
              <table role="presentation" cellspacing="0" cellpadding="0" style="width:100%;border-collapse:collapse;font-size:14px;color:#0f172a;">
                <tr>
                  <td style="padding:8px 0;color:#64748b;">Student</td>
                  <td style="padding:8px 0;text-align:right;font-weight:700;">${safeStudentName}</td>
                </tr>
                <tr>
                  <td style="padding:8px 0;color:#64748b;">Voucher No</td>
                  <td style="padding:8px 0;text-align:right;font-weight:700;">${safeVoucherNo}</td>
                </tr>
                <tr>
                  <td style="padding:8px 0;color:#64748b;">Amount</td>
                  <td style="padding:8px 0;text-align:right;font-weight:700;">${safeAmount}</td>
                </tr>
                <tr>
                  <td style="padding:8px 0;color:#64748b;">Due Date</td>
                  <td style="padding:8px 0;text-align:right;font-weight:700;">${safeDueDate}</td>
                </tr>
              </table>
            </div>

            <div style="margin:24px 0 0;text-align:center;">
              <a href="${safePortalUrl}" style="display:inline-block;background:#0f172a;color:#ffffff;text-decoration:none;padding:14px 22px;border-radius:14px;font-weight:700;font-size:14px;">Open Voucher</a>
            </div>

            <p style="margin:22px 0 0;font-size:12px;line-height:1.7;color:#64748b;">If the button does not work, open this link in your browser:<br>${safePortalUrl}</p>
          </div>
        </div>
      </div>
    </div>
  `;
}

function stripHtml(value) {
  return String(value || "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export async function sendEmail({ to, subject, html, text }) {
  const destination = String(to || "").trim();
  if (!destination) {
    throw new Error("Recipient email is required.");
  }

  const apiKey = process.env.SENDGRID_API_KEY;
  const fromAddress =
    process.env.SENDGRID_FROM_EMAIL ||
    process.env.SENDGRID_FROM ||
    process.env.EMAIL_FROM;
  const fromName = process.env.SENDGRID_FROM_NAME || "LMS Platform";

  if (!apiKey || !fromAddress) {
    throw new Error(
      "SendGrid is not configured. Set SENDGRID_API_KEY and SENDGRID_FROM_EMAIL."
    );
  }

  const response = await fetch("https://api.sendgrid.com/v3/mail/send", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      personalizations: [{ to: [{ email: destination }] }],
      from: { email: fromAddress, name: fromName },
      subject,
      content: [
        { type: "text/plain", value: text || stripHtml(html) },
        { type: "text/html", value: html },
      ],
    }),
    cache: "no-store",
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`SendGrid email failed: ${errorText}`);
  }

  return true;
}

export function buildCredentialsEmailHtml({
  recipientName,
  studentName,
  parentLogin,
  parentPassword,
  studentLogin,
  studentPassword,
  portalUrl,
}) {
  const safeRecipientName = escapeHtml(recipientName);
  const safeStudentName = escapeHtml(studentName);
  const safeParentLogin = escapeHtml(parentLogin);
  const safeParentPassword = escapeHtml(parentPassword);
  const safeStudentLogin = escapeHtml(studentLogin);
  const safeStudentPassword = escapeHtml(studentPassword);
  const safePortalUrl = escapeHtml(portalUrl);

  return `
    <div style="margin:0;padding:0;background:#f8fafc;font-family:Arial,sans-serif;color:#0f172a;">
      <div style="max-width:640px;margin:0 auto;padding:32px 20px;">
        <div style="background:#ffffff;border:1px solid #e2e8f0;border-radius:24px;overflow:hidden;box-shadow:0 18px 60px rgba(15,23,42,.08);">
          <div style="padding:28px;background:#0f172a;color:#ffffff;">
            <p style="margin:0 0 8px;font-size:12px;letter-spacing:.18em;text-transform:uppercase;opacity:.8;">LMS Access Granted</p>
            <h1 style="margin:0;font-size:28px;line-height:1.2;">Your LMS accounts are ready</h1>
          </div>
          <div style="padding:28px;">
            <p style="margin:0 0 18px;font-size:15px;line-height:1.7;color:#334155;">Hello, <strong>${safeRecipientName}</strong>.</p>
            <p style="margin:0 0 22px;font-size:15px;line-height:1.7;color:#334155;">Payment has been verified for <strong>${safeStudentName}</strong>. Please use the credentials below to sign in.</p>
            <div style="border:1px solid #e2e8f0;border-radius:18px;padding:18px;background:#f8fafc;">
              <p style="margin:0 0 10px;font-weight:700;">Parent account</p>
              <p style="margin:0 0 6px;color:#334155;">Login: <strong>${safeParentLogin}</strong></p>
              <p style="margin:0 0 18px;color:#334155;">Temporary password: <strong>${safeParentPassword}</strong></p>
              <p style="margin:0 0 10px;font-weight:700;">Student account</p>
              <p style="margin:0 0 6px;color:#334155;">Login: <strong>${safeStudentLogin}</strong></p>
              <p style="margin:0;color:#334155;">Temporary password: <strong>${safeStudentPassword}</strong></p>
            </div>
            <div style="margin:24px 0 0;text-align:center;">
              <a href="${safePortalUrl}" style="display:inline-block;background:#0f172a;color:#ffffff;text-decoration:none;padding:14px 22px;border-radius:14px;font-weight:700;font-size:14px;">Open LMS</a>
            </div>
            <p style="margin:22px 0 0;font-size:12px;line-height:1.7;color:#64748b;">You will be asked to change the temporary password after sign in.</p>
          </div>
        </div>
      </div>
    </div>
  `;
}

export function buildLectureJoinEmailHtml({
  recipientName,
  lectureTitle,
  studentName,
  subjectName,
  scheduledStart,
  portalUrl,
  meetLink,
}) {
  const safeRecipientName = escapeHtml(recipientName || "Learner");
  const safeLectureTitle = escapeHtml(lectureTitle);
  const safeStudentName = escapeHtml(studentName);
  const safeSubjectName = escapeHtml(subjectName);
  const safeScheduledStart = escapeHtml(
    scheduledStart
      ? new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" }).format(new Date(scheduledStart))
      : ""
  );
  const safePortalUrl = escapeHtml(portalUrl);
  const safeMeetLink = escapeHtml(meetLink);

  return `
    <div style="margin:0;padding:0;background:#f8fafc;font-family:Arial,sans-serif;color:#0f172a;">
      <div style="max-width:640px;margin:0 auto;padding:32px 20px;">
        <div style="background:#ffffff;border:1px solid #e2e8f0;border-radius:24px;overflow:hidden;box-shadow:0 18px 60px rgba(15,23,42,.08);">
          <div style="padding:28px;background:#0f172a;color:#ffffff;">
            <p style="margin:0 0 8px;font-size:12px;letter-spacing:.18em;text-transform:uppercase;opacity:.8;">Lecture Link Available</p>
            <h1 style="margin:0;font-size:28px;line-height:1.2;">Your lecture joining link is available in the portal</h1>
          </div>
          <div style="padding:28px;">
            <p style="margin:0 0 18px;font-size:15px;line-height:1.7;color:#334155;">Hello, <strong>${safeRecipientName}</strong>.</p>
            <p style="margin:0 0 22px;font-size:15px;line-height:1.7;color:#334155;">A lecture has been scheduled. You can open the LMS portal to view the class details and join during the scheduled class window.</p>
            <div style="border:1px solid #e2e8f0;border-radius:18px;padding:18px;background:#f8fafc;">
              <p style="margin:0 0 8px;color:#334155;">Lecture: <strong>${safeLectureTitle}</strong></p>
              <p style="margin:0 0 8px;color:#334155;">Student: <strong>${safeStudentName}</strong></p>
              <p style="margin:0 0 8px;color:#334155;">Subject: <strong>${safeSubjectName}</strong></p>
              <p style="margin:0;color:#334155;">Schedule: <strong>${safeScheduledStart}</strong></p>
            </div>
            <div style="margin:24px 0 0;text-align:center;">
              <a href="${safePortalUrl}" style="display:inline-block;background:#0f172a;color:#ffffff;text-decoration:none;padding:14px 22px;border-radius:14px;font-weight:700;font-size:14px;">Open Portal</a>
            </div>
            <p style="margin:22px 0 0;font-size:12px;line-height:1.7;color:#64748b;">Direct Meet link:<br>${safeMeetLink}</p>
          </div>
        </div>
      </div>
    </div>
  `;
}

export function getAppUrl() {
  return getBaseUrl();
}
