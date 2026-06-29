export interface CheckResult {
  word: string;
  url: string;
  status: "working" | "dead" | "checking" | "pending";
  statusCode?: number;
  responseTime?: number;
  checkedAt?: string;
}

export function buildUrl(template: string, word: string): string {
  return template.replace(/\(Word\)/gi, word.trim());
}

export async function checkUrl(url: string): Promise<{ working: boolean; statusCode?: number; responseTime: number }> {
  const start = Date.now();
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    await fetch(url, {
      method: "HEAD",
      signal: controller.signal,
      cache: "no-store",
      mode: "no-cors",
    });
    clearTimeout(timeout);
    return { working: true, statusCode: 200, responseTime: Date.now() - start };
  } catch (err: unknown) {
    const responseTime = Date.now() - start;
    if (err instanceof Error && err.name === "AbortError") {
      return { working: false, responseTime };
    }
    try {
      const controller2 = new AbortController();
      const timeout2 = setTimeout(() => controller2.abort(), 6000);
      await fetch(url, {
        method: "GET",
        signal: controller2.signal,
        cache: "no-store",
        mode: "no-cors",
      });
      clearTimeout(timeout2);
      return { working: true, responseTime: Date.now() - start };
    } catch {
      return { working: false, responseTime };
    }
  }
}

const ADJECTIVES = ["swift","brave","golden","silver","alpha","omega","delta","sigma","ghost","shadow","blaze","storm","thunder","frost","neon","pixel","cyber","ultra","mega","hyper"];
const NOUNS = ["wolf","eagle","hunter","runner","raider","scout","ranger","warrior","striker","phantom","falcon","cobra","panther","titan","viper","apex","nexus","core","pulse","bolt"];

export function generateSessionName(): string {
  const adj = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
  const noun = NOUNS[Math.floor(Math.random() * NOUNS.length)];
  const num = Math.floor(Math.random() * 9000) + 1000;
  return `${adj}-${noun}-${num}`;
}

export type CheckMode = "template" | "multilink";

export interface Session {
  id: string;
  name: string;
  mode: CheckMode;
  template: string;
  words: string[];
  links: string[];
  results: CheckResult[];
  createdAt: string;
  lastCheckedAt?: string;
  loopInterval?: number;
  loopActive?: boolean;
  workingLinks: string[];
  notifEmail?: string;
}

const SESSIONS_KEY = "ff_tools_sessions_v2";

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
