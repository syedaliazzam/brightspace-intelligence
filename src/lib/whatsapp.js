function normalizePhoneNumber(value) {
  return String(value || "").replace(/[^\d]/g, "");
}

export async function sendWhatsAppText({ to, message }) {
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
  const apiVersion = process.env.WHATSAPP_API_VERSION || "v20.0";
  const recipient = normalizePhoneNumber(to);
  const body = String(message || "").trim();

  if (!phoneNumberId || !accessToken || !recipient || !body) {
    return { success: false, skipped: true };
  }

  const response = await fetch(`https://graph.facebook.com/${apiVersion}/${phoneNumberId}/messages`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to: recipient,
      type: "text",
      text: { body },
    }),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data?.error?.message || "WhatsApp message failed.");
  }

  return { success: true, data };
}
