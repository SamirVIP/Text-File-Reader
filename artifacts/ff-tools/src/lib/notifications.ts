export async function requestNotificationPermission(): Promise<boolean> {
  if (!("Notification" in window)) return false;
  if (Notification.permission === "granted") return true;
  if (Notification.permission === "denied") return false;
  const permission = await Notification.requestPermission();
  return permission === "granted";
}

export function sendBrowserNotification(title: string, body: string, url?: string) {
  if (!("Notification" in window) || Notification.permission !== "granted") return;
  try {
    const n = new Notification(title, {
      body,
      tag: "ff-tools-working-link",
      requireInteraction: true,
    });
    if (url) n.onclick = () => { window.open(url, "_blank"); n.close(); };
  } catch {}
}

function buildEmailHtml(workingUrls: string[], sessionName: string): string {
  const linksHtml = workingUrls
    .map(u => `<li style="margin-bottom:6px"><a href="${u}" style="color:#a78bfa;word-break:break-all">${u}</a></li>`)
    .join("");
  return `
    <div style="font-family:system-ui,sans-serif;max-width:600px;margin:auto;background:#0f1117;color:#e2e8f0;border-radius:12px;overflow:hidden">
      <div style="background:linear-gradient(135deg,#7c3aed,#4338ca);padding:28px 32px">
        <h1 style="margin:0;font-size:22px;color:#fff">🔗 Working Link Found!</h1>
        <p style="margin:8px 0 0;color:#c4b5fd;font-size:14px">Session: <strong>${sessionName}</strong></p>
      </div>
      <div style="padding:28px 32px">
        <p style="color:#f87171;font-size:20px;font-weight:700;margin:0 0 16px">Working! Working! New Working Link Found Check Out!</p>
        <p style="color:#94a3b8;font-size:14px;margin:0 0 12px">${workingUrls.length} working link(s) found:</p>
        <ul style="margin:0;padding-left:20px;color:#a3e635">${linksHtml}</ul>
        <p style="color:#475569;font-size:12px;margin:24px 0 0;border-top:1px solid #1e293b;padding-top:16px">Checked at: ${new Date().toLocaleString("en-US", { hour12: true })}</p>
      </div>
    </div>`;
}

export async function sendResendEmail(
  toEmail: string,
  workingUrls: string[],
  sessionName: string,
): Promise<{ success: boolean; error?: string }> {
  if (!toEmail) return { success: false, error: "No email address" };
  try {
    const res = await fetch("/api/send-email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        to: toEmail,
        subject: `🔗 Working! Working! New Working Link Found – ${sessionName}`,
        html: buildEmailHtml(workingUrls, sessionName),
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return { success: false, error: (data as { error?: string }).error || `HTTP ${res.status}` };
    return { success: true };
  } catch (e: unknown) {
    return { success: false, error: e instanceof Error ? e.message : "Network error" };
  }
}

export async function sendTestEmail(toEmail: string): Promise<{ success: boolean; error?: string }> {
  return sendResendEmail(toEmail, ["https://dl.dir.freefiremobile.com/test-link-example.jpg"], "Test Session");
}
