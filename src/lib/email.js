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

export async function sendEmail({ to, subject, html }) {
  const destination = String(to || "").trim();
  if (!destination) {
    throw new Error("Recipient email is required.");
  }

  const smtpHost = process.env.SMTP_HOST || "smtp.gmail.com";
  const smtpPort = Number(process.env.SMTP_PORT || 465);
  const smtpSecure = String(process.env.SMTP_SECURE || "true").toLowerCase() !== "false";
  const smtpUser = process.env.SMTP_USER || process.env.GMAIL_USER;
  const smtpPass = process.env.SMTP_PASS || process.env.GMAIL_APP_PASSWORD;
  const fromAddress = process.env.SMTP_FROM || smtpUser;

  if (!smtpUser || !smtpPass || !fromAddress) {
    throw new Error(
      "Email transport is not configured. Set SMTP_USER, SMTP_PASS, and SMTP_FROM."
    );
  }

  const nodemailer = await import("nodemailer");
  const transporter = nodemailer.default.createTransport({
    host: smtpHost,
    port: smtpPort,
    secure: smtpSecure,
    auth: {
      user: smtpUser,
      pass: smtpPass,
    },
  });

  await transporter.sendMail({
    from: fromAddress,
    to: destination,
    subject,
    html,
  });

  return true;
}

export function getAppUrl() {
  return getBaseUrl();
}
