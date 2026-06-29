const RESEND_API_KEY = "re_66qSGQ9y_5ijUp5mkcbCNkxPR7aPvSn4x";
const FROM_EMAIL = "onboarding@resend.dev";
const DEFAULT_RECIPIENT = "samirrahman097@gmail.com";

export async function requestNotificationPermission(): Promise<boolean> {
  if (!("Notification" in window)) return false;
  if (Notification.permission === "granted") return true;
  if (Notification.permission === "denied") return false;
  const permission = await Notification.requestPermission();
  return permission === "granted";
}

export function sendBrowserNotification(title: string, body: string, url?: string) {
  if (Notification.permission !== "granted") return;
  const n = new Notification(title, {
    body,
    icon: "/favicon.ico",
    tag: "ff-tools-url-checker",
    requireInteraction: true,
  });
  if (url) {
    n.onclick = () => { window.open(url, "_blank"); n.close(); };
  }
}

export async function sendResendEmail(
  toEmail: string,
  workingUrls: string[],
  sessionName: string
): Promise<{ success: boolean; error?: string }> {
  const recipient = toEmail || DEFAULT_RECIPIENT;
  const linksHtml = workingUrls.map(u => `<li><a href="${u}" style="color:#7c3aed">${u}</a></li>`).join("");
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: `FF Tools <${FROM_EMAIL}>`,
        to: [recipient],
        subject: `🔗 Working! Working! New Working Link Found – ${sessionName}`,
        html: `
          <div style="font-family:sans-serif;max-width:560px;margin:auto;background:#0f1117;color:#e2e8f0;border-radius:12px;overflow:hidden">
            <div style="background:linear-gradient(135deg,#7c3aed,#4f46e5);padding:28px 32px">
              <h1 style="margin:0;font-size:22px;color:#fff">🔗 Working Link Found!</h1>
              <p style="margin:6px 0 0;color:#c4b5fd;font-size:14px">Session: <strong>${sessionName}</strong></p>
            </div>
            <div style="padding:28px 32px">
              <p style="color:#f87171;font-size:18px;font-weight:700;margin:0 0 16px">Working! Working! New Working Link Found Check Out!</p>
              <p style="color:#94a3b8;font-size:13px;margin:0 0 12px">The following ${workingUrls.length} link(s) are currently active:</p>
              <ul style="margin:0;padding-left:20px;color:#a3e635">${linksHtml}</ul>
              <p style="color:#64748b;font-size:12px;margin:20px 0 0">Checked at: ${new Date().toLocaleString()}</p>
            </div>
          </div>
        `,
      }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return { success: false, error: (err as { message?: string }).message || `HTTP ${res.status}` };
    }
    return { success: true };
  } catch (e: unknown) {
    return { success: false, error: e instanceof Error ? e.message : "Network error" };
  }
}

export async function sendTestEmail(toEmail: string): Promise<{ success: boolean; error?: string }> {
  return sendResendEmail(toEmail, ["https://example.com/test-link"], "Test Session");
}
