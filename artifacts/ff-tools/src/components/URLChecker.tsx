import { useState, useEffect, useRef, useCallback } from "react";
import {
  buildUrl, checkUrl, generateSessionName, loadSessions, saveSessions,
  CheckResult, Session, CheckMode,
} from "@/lib/urlChecker";
import {
  requestNotificationPermission, sendBrowserNotification,
  sendResendEmail, sendTestEmail,
} from "@/lib/notifications";
import { useAuth } from "@/contexts/AuthContext";

export default function URLChecker() {
  const { user } = useAuth();
  const [checkMode, setCheckMode] = useState<CheckMode>("template");
  const [template, setTemplate] = useState("");
  const [wordsInput, setWordsInput] = useState("");
  const [linksInput, setLinksInput] = useState("");
  const [results, setResults] = useState<CheckResult[]>([]);
  const [isChecking, setIsChecking] = useState(false);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [activeSession, setActiveSession] = useState<Session | null>(null);
  const [notifEmail, setNotifEmail] = useState(user?.email || "");
  const [loopInterval, setLoopInterval] = useState<5 | 10 | 15>(5);
  const [loopEnabled, setLoopEnabled] = useState(false);
  const [loopCountdown, setLoopCountdown] = useState(0);
  const [loopSessionId, setLoopSessionId] = useState<string | null>(null);
  const [notifPermission, setNotifPermission] = useState(Notification.permission);
  const [checkProgress, setCheckProgress] = useState(0);
  const [emailSending, setEmailSending] = useState(false);
  const [emailStatus, setEmailStatus] = useState<{ ok: boolean; msg: string } | null>(null);
  const loopTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const checkingRef = useRef(false);

  useEffect(() => { setSessions(loadSessions()); }, []);
  useEffect(() => { setNotifEmail(user?.email || ""); }, [user?.email]);
  useEffect(() => () => clearLoopTimers(), []);

  const clearLoopTimers = () => {
    if (loopTimerRef.current) clearTimeout(loopTimerRef.current);
    if (countdownRef.current) clearInterval(countdownRef.current);
    loopTimerRef.current = null;
    countdownRef.current = null;
  };

  const requestNotif = async () => {
    const granted = await requestNotificationPermission();
    setNotifPermission(granted ? "granted" : "denied");
  };

  const testEmail = async () => {
    if (!notifEmail) return setEmailStatus({ ok: false, msg: "Enter an email first" });
    setEmailSending(true);
    setEmailStatus(null);
    const res = await sendTestEmail(notifEmail);
    setEmailSending(false);
    setEmailStatus(res.success ? { ok: true, msg: "Test email sent!" } : { ok: false, msg: res.error || "Failed" });
    setTimeout(() => setEmailStatus(null), 4000);
  };

  const runCheck = useCallback(async (
    mode: CheckMode, tpl: string, words: string[], links: string[], email: string, sessionName: string
  ): Promise<CheckResult[]> => {
    checkingRef.current = true;
    setIsChecking(true);
    setCheckProgress(0);

    const items: CheckResult[] = mode === "template"
      ? words.map(w => ({ word: w, url: buildUrl(tpl, w), status: "pending" as const }))
      : links.map(l => ({ word: l, url: l.trim(), status: "pending" as const }));

    setResults([...items]);
    const newResults: CheckResult[] = [...items];
    const workingFound: string[] = [];

    for (let i = 0; i < newResults.length; i++) {
      if (!checkingRef.current) break;
      newResults[i] = { ...newResults[i], status: "checking" };
      setResults([...newResults]);

      const { working, statusCode, responseTime } = await checkUrl(newResults[i].url);
      newResults[i] = {
        ...newResults[i],
        status: working ? "working" : "dead",
        statusCode,
        responseTime,
        checkedAt: new Date().toLocaleTimeString(),
      };
      if (working) workingFound.push(newResults[i].url);
      setResults([...newResults]);
      setCheckProgress(Math.round(((i + 1) / newResults.length) * 100));
    }

    if (workingFound.length > 0) {
      sendBrowserNotification(
        "Working! Working! New Working Link Found!",
        `${workingFound.length} working link(s) found! Check Out!`,
        workingFound[0]
      );
      if (email) {
        sendResendEmail(email, workingFound, sessionName);
      }
    }

    setIsChecking(false);
    checkingRef.current = false;
    return newResults;
  }, []);

  const startCheck = async () => {
    const words = wordsInput.split("\n").map(w => w.trim()).filter(Boolean);
    const links = linksInput.split("\n").map(l => l.trim()).filter(Boolean);

    if (checkMode === "template") {
      if (!template.trim()) return alert("Please enter a URL template");
      if (!words.length) return alert("Please enter at least one word");
    } else {
      if (!links.length) return alert("Please enter at least one link");
      const invalid = links.filter(l => !l.startsWith("http"));
      if (invalid.length > 0 && !window.confirm(`${invalid.length} link(s) don't start with http. Continue anyway?`)) return;
    }

    clearLoopTimers();
    const sessionName = generateSessionName();
    const newResults = await runCheck(checkMode, template, words, links, notifEmail, sessionName);

    const session: Session = {
      id: Date.now().toString(),
      name: sessionName,
      mode: checkMode,
      template,
      words,
      links,
      results: newResults,
      createdAt: new Date().toISOString(),
      lastCheckedAt: new Date().toISOString(),
      loopInterval: loopEnabled ? loopInterval : undefined,
      loopActive: loopEnabled,
      workingLinks: newResults.filter(r => r.status === "working").map(r => r.url),
      notifEmail,
    };

    const updated = [session, ...sessions];
    setSessions(updated);
    saveSessions(updated);
    setActiveSession(session);

    if (loopEnabled) {
      setLoopSessionId(session.id);
      startLoopTimer(checkMode, template, words, links, notifEmail, sessionName, session, updated);
    }
  };

  const startLoopTimer = (
    mode: CheckMode, tpl: string, words: string[], links: string[], email: string,
    sessionName: string, sess: Session, allSessions: Session[]
  ) => {
    const intervalMs = loopInterval * 60 * 1000;
    let remaining = intervalMs;
    setLoopCountdown(intervalMs);
    clearLoopTimers();

    countdownRef.current = setInterval(() => {
      remaining -= 1000;
      setLoopCountdown(Math.max(0, remaining));
    }, 1000);

    loopTimerRef.current = setTimeout(async () => {
      if (countdownRef.current) clearInterval(countdownRef.current);
      const newRes = await runCheck(mode, tpl, words, links, email, sessionName);
      const updated = allSessions.map(s =>
        s.id === sess.id
          ? { ...s, results: newRes, lastCheckedAt: new Date().toISOString(), workingLinks: newRes.filter(r => r.status === "working").map(r => r.url) }
          : s
      );
      setSessions(updated);
      saveSessions(updated);
      startLoopTimer(mode, tpl, words, links, email, sessionName, sess, updated);
    }, intervalMs);
  };

  const startLoopFromHistory = (s: Session, interval: 5 | 10 | 15) => {
    clearLoopTimers();
    setLoopEnabled(true);
    setLoopInterval(interval);
    setLoopSessionId(s.id);
    setActiveSession(s);
    setTemplate(s.template);
    setWordsInput(s.words.join("\n"));
    setLinksInput(s.links?.join("\n") || "");
    setResults(s.results);
    setCheckMode(s.mode || "template");
    const allSessions = sessions;
    startLoopTimer(s.mode || "template", s.template, s.words, s.links || [], s.notifEmail || notifEmail, s.name, s, allSessions);
  };

  const stopLoop = () => {
    clearLoopTimers();
    setLoopCountdown(0);
    setLoopEnabled(false);
    setLoopSessionId(null);
  };

  const stopCheck = () => {
    checkingRef.current = false;
    setIsChecking(false);
  };

  const loadSession = (s: Session) => {
    stopLoop();
    setActiveSession(s);
    setTemplate(s.template);
    setWordsInput(s.words.join("\n"));
    setLinksInput(s.links?.join("\n") || "");
    setResults(s.results);
    setCheckMode(s.mode || "template");
    setLoopEnabled(!!s.loopActive);
    if (s.loopInterval) setLoopInterval(s.loopInterval as 5 | 10 | 15);
  };

  const deleteSession = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = sessions.filter(s => s.id !== id);
    setSessions(updated);
    saveSessions(updated);
    if (activeSession?.id === id) { setActiveSession(null); setResults([]); }
    if (loopSessionId === id) stopLoop();
  };

  const working = results.filter(r => r.status === "working").length;
  const dead = results.filter(r => r.status === "dead").length;
  const pending = results.filter(r => r.status === "pending" || r.status === "checking").length;

  const formatCountdown = (ms: number) => {
    const s = Math.floor(ms / 1000);
    const m = Math.floor(s / 60);
    return `${m}:${String(s % 60).padStart(2, "0")}`;
  };

  return (
    <div className="flex gap-4 h-full min-h-[600px]">
      {/* Sidebar */}
      <div className="w-64 shrink-0 flex flex-col gap-3">
        {/* History */}
        <div className="glass rounded-2xl p-4 flex-1">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-sm">Session History</h3>
            <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">{sessions.length}</span>
          </div>
          {sessions.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-4">No sessions yet. Start checking!</p>
          ) : (
            <div className="space-y-2 max-h-[380px] overflow-y-auto pr-1">
              {sessions.map(s => (
                <div
                  key={s.id}
                  className={`rounded-xl transition-all duration-150 group ${activeSession?.id === s.id ? "bg-primary/20 border border-primary/30" : "bg-muted/50 hover:bg-muted border border-transparent"}`}
                >
                  <button onClick={() => loadSession(s)} className="w-full text-left p-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-foreground truncate flex-1">{s.name}</span>
                      <button
                        onClick={e => deleteSession(s.id, e)}
                        className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-red-400 transition ml-1 shrink-0"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                    <div className="mt-1 flex gap-2 flex-wrap">
                      <span className="text-[10px] text-green-400 font-medium">{s.workingLinks.length} ✓</span>
                      <span className="text-[10px] text-muted-foreground">{s.mode === "multilink" ? `${s.links?.length || 0} links` : `${s.words.length} words`}</span>
                      <span className={`text-[10px] px-1.5 rounded-full ${s.mode === "multilink" ? "bg-blue-500/20 text-blue-400" : "bg-purple-500/20 text-purple-400"}`}>
                        {s.mode === "multilink" ? "multi" : "tpl"}
                      </span>
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-0.5">{new Date(s.createdAt).toLocaleString()}</p>
                  </button>

                  {/* Loop from history */}
                  <div className="px-3 pb-2 flex items-center gap-1.5 border-t border-border/30 pt-2">
                    <span className="text-[10px] text-muted-foreground mr-auto">Loop:</span>
                    {([5, 10, 15] as const).map(m => (
                      <button
                        key={m}
                        onClick={e => { e.stopPropagation(); startLoopFromHistory(s, m); }}
                        className={`text-[10px] px-2 py-0.5 rounded-lg font-medium transition ${loopSessionId === s.id && loopInterval === m ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-secondary"}`}
                      >
                        {m}m
                      </button>
                    ))}
                    {loopSessionId === s.id && (
                      <button
                        onClick={e => { e.stopPropagation(); stopLoop(); }}
                        className="text-[10px] px-1.5 py-0.5 rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500/30 transition"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Notification Management */}
        <div className="glass rounded-2xl p-4 space-y-3">
          <h3 className="font-semibold text-sm flex items-center gap-2">
            <svg className="w-4 h-4 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
            </svg>
            Notifications
          </h3>

          {/* Browser */}
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">Browser alerts</span>
            {notifPermission === "granted" ? (
              <span className="text-[10px] text-green-400 flex items-center gap-1">
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                ON
              </span>
            ) : notifPermission === "denied" ? (
              <span className="text-[10px] text-red-400">Blocked</span>
            ) : (
              <button onClick={requestNotif} className="text-[10px] px-2 py-1 rounded-lg bg-primary/20 text-primary hover:bg-primary/30 transition">
                Enable
              </button>
            )}
          </div>

          {/* Email */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Email alerts (Resend)</span>
              <span className="text-[10px] text-green-400">Active</span>
            </div>
            <input
              value={notifEmail}
              onChange={e => setNotifEmail(e.target.value)}
              type="email"
              placeholder="your@email.com"
              className="w-full px-3 py-2 text-xs rounded-lg bg-input border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 transition"
            />
            <button
              onClick={testEmail}
              disabled={emailSending}
              className="w-full py-1.5 rounded-lg text-xs font-medium bg-primary/20 text-primary hover:bg-primary/30 transition disabled:opacity-50 flex items-center justify-center gap-1.5"
            >
              {emailSending ? (
                <><svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>Sending...</>
              ) : "Send Test Email"}
            </button>
            {emailStatus && (
              <p className={`text-[10px] text-center ${emailStatus.ok ? "text-green-400" : "text-red-400"}`}>
                {emailStatus.msg}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Main Panel */}
      <div className="flex-1 flex flex-col gap-4 min-w-0">
        {/* Config */}
        <div className="glass rounded-2xl p-5 space-y-4">
          {/* Mode Switch */}
          <div className="flex rounded-xl overflow-hidden border border-border">
            <button
              onClick={() => setCheckMode("template")}
              className={`flex-1 py-2 text-sm font-medium transition-all flex items-center justify-center gap-2 ${checkMode === "template" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" /></svg>
              Template Mode
            </button>
            <button
              onClick={() => setCheckMode("multilink")}
              className={`flex-1 py-2 text-sm font-medium transition-all flex items-center justify-center gap-2 ${checkMode === "multilink" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" /></svg>
              Multi-Link Mode
            </button>
          </div>

          {checkMode === "template" ? (
            <>
              <div>
                <label className="block text-sm font-medium mb-2">URL Template — <code className="text-primary bg-primary/10 px-1.5 py-0.5 rounded text-xs font-mono">(Word)</code> is replaced for each word</label>
                <input
                  value={template}
                  onChange={e => setTemplate(e.target.value)}
                  placeholder="https://dl.dir.freefiremobile.com/common/Local/IND/config/26J01_TW1_(Word)_Tab_SG_en.jpg"
                  className="w-full px-4 py-3 rounded-xl bg-input border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 font-mono text-sm transition"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">
                  Words List <span className="text-xs text-muted-foreground font-normal">(one per line)</span>
                </label>
                <textarea
                  value={wordsInput}
                  onChange={e => setWordsInput(e.target.value)}
                  placeholder={"OB54\nOB55\nOB56\nSeason1\nSeason2"}
                  rows={5}
                  className="w-full px-4 py-3 rounded-xl bg-input border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 font-mono text-sm transition resize-none"
                />
                <p className="text-xs text-muted-foreground mt-1">{wordsInput.split("\n").filter(Boolean).length} words</p>
              </div>
            </>
          ) : (
            <div>
              <label className="block text-sm font-medium mb-2">
                Links to Check <span className="text-xs text-muted-foreground font-normal">(one link per line)</span>
              </label>
              <textarea
                value={linksInput}
                onChange={e => setLinksInput(e.target.value)}
                placeholder={"https://example.com/file1.jpg\nhttps://example.com/file2.jpg\nhttps://example.com/file3.jpg"}
                rows={7}
                className="w-full px-4 py-3 rounded-xl bg-input border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 font-mono text-sm transition resize-none"
              />
              <p className="text-xs text-muted-foreground mt-1">{linksInput.split("\n").filter(Boolean).length} links</p>
            </div>
          )}

          {/* Loop Settings */}
          <div className="flex items-center gap-4 flex-wrap">
            <label className="flex items-center gap-2 cursor-pointer" onClick={() => setLoopEnabled(!loopEnabled)}>
              <div className={`w-10 h-5 rounded-full transition-colors relative ${loopEnabled ? "bg-primary" : "bg-muted"}`}>
                <div className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${loopEnabled ? "translate-x-5" : ""}`} />
              </div>
              <span className="text-sm font-medium">Auto Loop</span>
            </label>
            {loopEnabled && (
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Every</span>
                {([5, 10, 15] as const).map(m => (
                  <button
                    key={m}
                    onClick={() => setLoopInterval(m)}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${loopInterval === m ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-secondary"}`}
                  >
                    {m}m
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 flex-wrap">
            {!isChecking ? (
              <button
                onClick={startCheck}
                className="px-6 py-3 rounded-xl bg-primary text-primary-foreground font-semibold hover:opacity-90 active:scale-[0.98] transition-all glow-primary flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Start Checking
              </button>
            ) : (
              <button onClick={stopCheck} className="px-6 py-3 rounded-xl bg-destructive text-destructive-foreground font-semibold hover:opacity-90 transition flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 10a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z" />
                </svg>
                Stop Checking
              </button>
            )}
            {loopCountdown > 0 && (
              <button onClick={stopLoop} className="px-4 py-3 rounded-xl bg-muted text-muted-foreground font-medium hover:bg-secondary transition text-sm flex items-center gap-2">
                <svg className="w-3.5 h-3.5 text-primary animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                </svg>
                <span className="text-primary font-mono font-bold">{formatCountdown(loopCountdown)}</span>
                <span>— next check · Cancel</span>
              </button>
            )}
          </div>
        </div>

        {/* Results */}
        {(isChecking || results.length > 0) && (
          <div className="glass rounded-2xl p-5">
            {/* Stats */}
            <div className="flex items-center gap-4 mb-3 flex-wrap">
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-green-400" />
                <span className="text-sm font-semibold text-green-400">{working} Working</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-red-400" />
                <span className="text-sm text-muted-foreground">{dead} Dead</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-muted-foreground" />
                <span className="text-sm text-muted-foreground">{pending} Pending</span>
              </div>
              {isChecking && (
                <div className="ml-auto flex items-center gap-2 text-sm text-muted-foreground">
                  <svg className="w-4 h-4 animate-spin text-primary" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                  </svg>
                  {checkProgress}%
                </div>
              )}
            </div>

            {isChecking && (
              <div className="w-full bg-muted rounded-full h-1.5 mb-4 overflow-hidden">
                <div className="h-full bg-primary rounded-full transition-all duration-300" style={{ width: `${checkProgress}%` }} />
              </div>
            )}

            <div className="space-y-2 max-h-[420px] overflow-y-auto">
              {results.map((r, i) => (
                <div
                  key={i}
                  className={`flex items-center gap-3 p-3 rounded-xl transition-all duration-200 ${
                    r.status === "working" ? "bg-green-500/10 border border-green-500/25" :
                    r.status === "dead" ? "bg-red-500/5 border border-red-500/10" :
                    r.status === "checking" ? "bg-primary/5 border border-primary/20 animate-pulse-slow" :
                    "bg-muted/30 border border-border/40"
                  }`}
                >
                  <div className="shrink-0">
                    {r.status === "working" && <div className="w-7 h-7 rounded-full bg-green-500/20 flex items-center justify-center"><svg className="w-4 h-4 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg></div>}
                    {r.status === "dead" && <div className="w-7 h-7 rounded-full bg-red-500/20 flex items-center justify-center"><svg className="w-4 h-4 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg></div>}
                    {r.status === "checking" && <div className="w-7 h-7 rounded-full bg-primary/20 flex items-center justify-center"><svg className="w-4 h-4 text-primary animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg></div>}
                    {r.status === "pending" && <div className="w-7 h-7 rounded-full bg-muted flex items-center justify-center"><div className="w-2 h-2 rounded-full bg-muted-foreground/50" /></div>}
                  </div>
                  <div className="flex-1 min-w-0">
                    {checkMode === "template" && (
                      <span className="font-mono text-xs font-semibold text-foreground block">{r.word}</span>
                    )}
                    <p className="text-[11px] text-muted-foreground truncate font-mono">{r.url}</p>
                    {r.responseTime !== undefined && (
                      <span className="text-[10px] text-muted-foreground">{r.responseTime}ms</span>
                    )}
                  </div>
                  {r.status === "working" && (
                    <a href={r.url} target="_blank" rel="noopener noreferrer" className="shrink-0 text-xs text-green-400 hover:text-green-300 font-medium transition">
                      Open ↗
                    </a>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
