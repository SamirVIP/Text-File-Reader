import type { IncomingMessage, ServerResponse } from "node:http";

const RESEND_API_KEY = "re_66qSGQ9y_5ijUp5mkcbCNkxPR7aPvSn4x";

function setCors(res: ServerResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (chunk: Buffer) => { data += chunk.toString(); });
    req.on("end", () => resolve(data));
    req.on("error", reject);
  });
}

function json(res: ServerResponse, status: number, body: unknown) {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(body));
}

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  setCors(res);

  if (req.method === "OPTIONS") {
    res.writeHead(200).end();
    return;
  }

  if (req.method !== "POST") {
    json(res, 405, { error: "Method not allowed" });
    return;
  }

  let body: { to?: string; subject?: string; html?: string };
  try {
    body = JSON.parse(await readBody(req)) as typeof body;
  } catch {
    json(res, 400, { error: "Invalid JSON body" });
    return;
  }

  const { to, subject, html } = body;
  if (!to || !subject || !html) {
    json(res, 400, { error: "Missing required fields: to, subject, html" });
    return;
  }

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: "FF Tools <onboarding@resend.dev>",
        to: [to],
        subject,
        html,
      }),
    });

    const data = await response.json().catch(() => ({})) as { message?: string };

    if (!response.ok) {
      json(res, response.status, { error: data.message ?? "Resend error" });
      return;
    }

    json(res, 200, { success: true });
  } catch (err: unknown) {
    json(res, 500, { error: err instanceof Error ? err.message : "Server error" });
  }
}
