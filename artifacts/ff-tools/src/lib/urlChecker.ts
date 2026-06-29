export interface CheckResult {
  word: string;
  templateLine: string;
  url: string;
  status: "working" | "dead" | "checking" | "pending";
  responseTime?: number;
  checkedAt?: string;
  previewUrl?: string;
}

export function buildUrl(template: string, word: string): string {
  return template.replace(/\(Word\)/gi, word.trim());
}

function isImageUrl(url: string): boolean {
  return /\.(jpg|jpeg|png|gif|webp|bmp|svg)(\?.*)?$/i.test(url.split("?")[0]);
}

export function checkUrl(url: string): Promise<{ working: boolean; responseTime: number; previewUrl?: string }> {
  return new Promise(resolve => {
    const start = Date.now();
    let settled = false;

    const done = (working: boolean, previewUrl?: string) => {
      if (settled) return;
      settled = true;
      resolve({ working, responseTime: Date.now() - start, previewUrl });
    };

    const timeout = setTimeout(() => done(false), 12000);

    if (isImageUrl(url)) {
      const img = new Image();
      img.onload = () => {
        clearTimeout(timeout);
        done(true, url);
      };
      img.onerror = () => {
        clearTimeout(timeout);
        done(false);
      };
      img.src = url + (url.includes("?") ? "&" : "?") + "_t=" + Date.now();
    } else {
      fetch(url, { method: "HEAD", cache: "no-store", mode: "no-cors" })
        .then(() => { clearTimeout(timeout); done(true); })
        .catch(() => {
          fetch(url, { method: "GET", cache: "no-store", mode: "no-cors" })
            .then(() => { clearTimeout(timeout); done(true); })
            .catch(() => { clearTimeout(timeout); done(false); });
        });
    }
  });
}

const ADJECTIVES = ["swift","brave","golden","silver","alpha","omega","delta","sigma","ghost","shadow","blaze","storm","thunder","frost","neon","pixel","cyber","ultra","mega","hyper"];
const NOUNS = ["wolf","eagle","hunter","runner","raider","scout","ranger","warrior","striker","phantom","falcon","cobra","panther","titan","viper","apex","nexus","core","pulse","bolt"];

export function generateSessionName(): string {
  const adj = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
  const noun = NOUNS[Math.floor(Math.random() * NOUNS.length)];
  const num = Math.floor(Math.random() * 9000) + 1000;
  return `${adj}-${noun}-${num}`;
}

export interface Session {
  id: string;
  name: string;
  templates: string[];
  words: string[];
  results: CheckResult[];
  createdAt: string;
  lastCheckedAt?: string;
  nextCheckAt?: string;
  loopInterval?: number;
  loopActive?: boolean;
  workingLinks: string[];
  notifEmail?: string;
}

const SESSIONS_KEY = "ff_tools_sessions_v3";

export function saveSessions(sessions: Session[]): void {
  localStorage.setItem(SESSIONS_KEY, JSON.stringify(sessions));
}

export function loadSessions(): Session[] {
  try {
    return JSON.parse(localStorage.getItem(SESSIONS_KEY) || "[]");
  } catch {
    return [];
  }
}

export function fmt12h(iso?: string): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-US", {
    month: "short", day: "numeric",
    hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true,
  });
}
