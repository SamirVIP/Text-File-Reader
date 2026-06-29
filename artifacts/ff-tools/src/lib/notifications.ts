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
    badge: "/favicon.ico",
    tag: "ff-tools-url-checker",
    requireInteraction: true,
  });
  if (url) {
    n.onclick = () => { window.open(url, "_blank"); n.close(); };
  }
}

export function sendEmailNotification(to: string, workingUrls: string[], sessionName: string) {
  const subject = encodeURIComponent(`Working! Working! New Working Link Found - ${sessionName}`);
  const body = encodeURIComponent(
    `Working! Working! New Working Link Found Check Out!\n\nSession: ${sessionName}\n\nWorking Links:\n${workingUrls.join("\n")}\n\nChecked at: ${new Date().toLocaleString()}`
  );
  window.open(`mailto:${to}?subject=${subject}&body=${body}`, "_blank");
}
