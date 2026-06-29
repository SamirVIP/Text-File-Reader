import { useState, useEffect, useRef, useCallback } from "react";
import {
  buildUrl, checkUrl, generateSessionName, loadSessions, saveSessions,
  CheckResult, Session, fmt12h,
} from "@/lib/urlChecker";
import {
  requestNotificationPermission, sendBrowserNotification,
  sendResendEmail, sendTestEmail,
} from "@/lib/notifications";
import { useAuth } from "@/contexts/AuthContext";

export default function URLChecker() {
  const { user } = useAuth();
  const [templatesInput, setTemplatesInput] = useState("");
  const [wordsInput, setWordsInput] = useState("");
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
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");

  const loopTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const checkingRef = useRef(false);

  useEffect(() => { setSessions(loadSessions()); }, []);
  useEffect(() => { setNotifEmail(user?.email || ""); }, [user?.email]);
  useEffect(() => () => { clearLoopTimers(); }, []);

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
    if (!notifEmail) return setEmailStatus({ ok: false, msg: "Enter email first" });
    setEmailSending(true);
    setEmailStatus(null);
    const res = await sendTestEmail(notifEmail);
    setEmailSending(false);
    setEmailStatus(res.success ? { ok: true, msg: "Test email sent! Check inbox." } : { ok: false, msg: res.error || "Failed" });
    setTimeout(() => setEmailStatus(null), 5000);
  };

  const runCheck = useCallback(async (
    templates: string[], words: string[], email: string, sessionName: string
  ): Promise<CheckResult[]> => {
    checkingRef.current = true;
    setIsChecking(true);
    setCheckProgress(0);

    const items: CheckResult[] = [];
    for (const word of words) {
      for (const tpl of templates) {
        items.push({ word, templateLine: tpl, url: buildUrl(tpl, word), status: "pending" });
      }
    }
    setResults([...items]);

    const newResults: CheckResult[] = [...items];
    const workingFound: string[] = [];

    for (let i = 0; i < newResults.length; i++) {
      if (!checkingRef.current) break;
      newResults[i] = { ...newResults[i], status: "checking" };
      setResults([...newResults]);

      const { working, responseTime, previewUrl } = await checkUrl(newResults[i].url);
      newResults[i] = {
        ...newResults[i],
        status: working ? "working" : "dead",
        responseTime,
        checkedAt: new Date().toISOString(),
        previewUrl: working ? previewUrl : undefined,
      };
      if (working) workingFound.push(newResults[i].url);
      setResults([...newResults]);
      setCheckProgress(Math.round(((i + 1) / newResults.length) * 100));
    }

    if (workingFound.length > 0) {
      sendBrowserNotification(
        "🔗 Working Link Found!",
        `Working! Working! ${workingFound.length} link(s) found! Check Out!`,
        workingFound[0]
      );
      if (email) sendResendEmail(email, workingFound, sessionName);
    }

    setIsChecking(false);
    checkingRef.current = false;
    return newResults;
  }, []);

  const buildNextCheckAt = (intervalMins: number) =>
    new Date(Date.now() + intervalMins * 60 * 1000).toISOString();

  const startCheck = async (overrideTemplates?: string[], overrideWords?: string[], overrideEmail?: string, overrideSessionName?: string) => {
    const templates = (overrideTemplates ?? templatesInput.split("\n").map(t => t.trim()).filter(Boolean));
    const words = (overrideWords ?? wordsInput.split("\n").map(w => w.trim()).filter(Boolean));
    const email = overrideEmail ?? notifEmail;

    if (!templates.length) return alert("Enter at least one URL template with (Word) placeholder");
    if (!words.length) return alert("Enter at least one word");

    clearLoopTimers();
    const sessionName = overrideSessionName ?? generateSessionName();
    const newResults = await runCheck(templates, words, email, sessionName);
    const now = new Date().toISOString();
    const nextAt = loopEnabled ? buildNextCheckAt(loopInterval) : undefined;

    const session: Session = {
      id: Date.now().toString(),
      name: sessionName,
      templates,
      words,
      results: newResults,
      createdAt: now,
      lastCheckedAt: now,
      nextCheckAt: nextAt,
      loopInterval: loopEnabled ? loopInterval : undefined,
      loopActive: loopEnabled,
      workingLinks: newResults.filter(r => r.status === "working").map(r => r.url),
      notifEmail: email,
    };

    const updated = [session, ...sessions];
    setSessions(updated);
    saveSessions(updated);
    setActiveSession(session);

    if (loopEnabled) {
      setLoopSessionId(session.id);
      startLoopTimer(templates, words, email, sessionName, session, updated, loopInterval);
    }
  };

  const reCheckSession = async (s: Session) => {
    setActiveSession(s);
    setTemplatesInput(s.templates.join("\n"));
    setWordsInput(s.words.join("\n"));
    setNotifEmail(s.notifEmail || "");

    const nowStr = new Date().toISOString();
    const newResults = await runCheck(s.templates, s.words, s.notifEmail || "", s.name);
    const nextAt = s.loopInterval ? buildNextCheckAt(s.loopInterval) : undefined;

    const updated = sessions.map(sess =>
      sess.id === s.id
        ? { ...sess, results: newResults, lastCheckedAt: nowStr, nextCheckAt: nextAt, workingLinks: newResults.filter(r => r.status === "working").map(r => r.url) }
        : sess
    );
    setSessions(updated);
    saveSessions(updated);
    setResults(newResults);
  };

  const startLoopTimer = (
    templates: string[], words: string[], email: string,
    sessionName: string, sess: Session, allSessions: Session[], interval: number
  ) => {
    const intervalMs = interval * 60 * 1000;
    let remaining = intervalMs;
    setLoopCountdown(intervalMs);
    clearLoopTimers();

    countdownRef.current = setInterval(() => {
      remaining -= 1000;
      setLoopCountdown(Math.max(0, remaining));
    }, 1000);

    loopTimerRef.current = setTimeout(async () => {
      if (countdownRef.current) clearInterval(countdownRef.current);
      const nowStr = new Date().toISOString();
      const nextAt = buildNextCheckAt(interval);
      const newRes = await runCheck(templates, words, email, sessionName);
      const updated = allSessions.map(s =>
        s.id === sess.id
          ? { ...s, results: newRes, lastCheckedAt: nowStr, nextCheckAt: nextAt, workingLinks: newRes.filter(r => r.status === "working").map(r => r.url) }
          : s
      );
      setSessions(updated);
      saveSessions(updated);
      startLoopTimer(templates, words, email, sessionName, sess, updated, interval);
    }, intervalMs);
  };

  const startLoopFromHistory = (s: Session, interval: 5 | 10 | 15) => {
    clearLoopTimers();
    setLoopEnabled(true);
    setLoopInterval(interval);
    setLoopSessionId(s.id);
    setActiveSession(s);
    setTemplatesInput(s.templates.join("\n"));
    setWordsInput(s.words.join("\n"));
    setResults(s.results);
    startLoopTimer(s.templates, s.words, s.notifEmail || notifEmail, s.name, s, sessions, interval);
  };

  const stopLoop = () => {
    clearLoopTimers();
    setLoopCountdown(0);
    setLoopEnabled(false);
    setLoopSessionId(null);
  };

  const stopCheck = () => { checkingRef.current = false; setIsChecking(false); };

  const loadSession = (s: Session) => {
    stopLoop();
    setActiveSession(s);
    setTemplatesInput(s.templates.join("\n"));
    setWordsInput(s.words.join("\n"));
    setResults(s.results);
    if (s.notifEmail) setNotifEmail(s.notifEmail);
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

  const saveRename = (id: string) => {
    if (!renameValue.trim()) return;
    const updated = sessions.map(s => s.id === id ? { ...s, name: renameValue.trim() } : s);
    setSessions(updated);
    saveSessions(updated);
    if (activeSession?.id === id) setActiveSession(prev => prev ? { ...prev, name: renameValue.trim() } : prev);
    setRenamingId(null);
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

        {/* Session History */}
        <div className="glass rounded-2xl p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-sm">Session History</h3>
            <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">{sessions.length}</span>
          </div>
          {sessions.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-4">No sessions yet</p>
          ) : (
            <div className="space-y-2 max-h-[360px] overflow-y-auto pr-0.5">
              {sessions.map(s => (
                <div
                  key={s.id}
                  className={`rounded-xl transition-all duration-150 group border ${activeSession?.id === s.id ? "bg-primary/15 border-primary/30" : "bg-muted/40 border-transparent hover:border-border"}`}
                >
                  {/* Session Header */}
                  <div className="p-2.5">
                    {renamingId === s.id ? (
                      <div className="flex gap-1.5">
                        <input
                          autoFocus
                          value={renameValue}
                          onChange={e => setRenameValue(e.target.value)}
                          onKeyDown={e => { if (e.key === "Enter") saveRename(s.id); if (e.key === "Escape") setRenamingId(null); }}
                          className="flex-1 text-xs px-2 py-1 rounded-lg bg-input border border-primary/40 text-foreground focus:outline-none"
                        />
                        <button onClick={() => saveRename(s.id)} className="text-[10px] px-2 py-1 rounded-lg bg-primary/20 text-primary hover:bg-primary/30 transition">Save</button>
                        <button onClick={() => setRenamingId(null)} className="text-[10px] px-1.5 py-1 rounded-lg bg-muted text-muted-foreground transition">✕</button>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between gap-1">
                        <button onClick={() => loadSession(s)} className="flex-1 text-left text-xs font-medium text-foreground truncate hover:text-primary transition">
                          {s.name}
                        </button>
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition shrink-0">
                          <button
                            onClick={e => { e.stopPropagation(); setRenamingId(s.id); setRenameValue(s.name); }}
                            title="Rename"
                            className="p-0.5 text-muted-foreground hover:text-primary transition"
                          >
                            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                          </button>
                          <button
                            onClick={e => deleteSession(s.id, e)}
                            title="Delete"
                            className="p-0.5 text-muted-foreground hover:text-red-400 transition"
                          >
                            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                          </button>
                        </div>
                      </div>
                    )}

                    <button onClick={() => loadSession(s)} className="w-full text-left mt-1 space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-green-400 font-medium">{s.workingLinks.length} ✓</span>
                        <span className="text-[10px] text-muted-foreground">{s.templates.length} tpl × {s.words.length} words</span>
                      </div>
                      <p className="text-[10px] text-muted-foreground">Last: {fmt12h(s.lastCheckedAt)}</p>
                      {s.nextCheckAt && loopSessionId === s.id && (
                        <p className="text-[10px] text-primary">Next: {fmt12h(s.nextCheckAt)}</p>
                      )}
                    </button>

                    {/* Re-check button */}
                    <button
                      onClick={e => { e.stopPropagation(); reCheckSession(s); }}
                      disabled={isChecking}
                      className="mt-2 w-full text-[10px] py-1 rounded-lg bg-muted hover:bg-secondary text-muted-foreground hover:text-foreground transition flex items-center justify-center gap-1 disabled:opacity-40"
                    >
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                      Re-Check Now
                    </button>
                  </div>

                  {/* Loop controls */}
                  <div className="px-2.5 pb-2.5 flex items-center gap-1 border-t border-border/20 pt-2">
                    <span className="text-[10px] text-muted-foreground mr-1">Loop:</span>
                    {([5, 10, 15] as const).map(m => (
                      <button
                        key={m}
                        onClick={e => { e.stopPropagation(); startLoopFromHistory(s, m); }}
                        className={`text-[10px] px-2 py-0.5 rounded-lg font-medium transition flex-1 ${loopSessionId === s.id && loopInterval === m ? "bg-primary text-primary-foreground" : "bg-muted/80 text-muted-foreground hover:bg-secondary"}`}
                      >
                        {m}m
                      </button>
                    ))}
                    {loopSessionId === s.id && (
                      <button
                        onClick={e => { e.stopPropagation(); stopLoop(); }}
                        className="text-[10px] px-1.5 py-0.5 rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500/30 transition"
                      >✕</button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Notification Settings */}
        <div className="glass rounded-2xl p-4 space-y-3">
          <h3 className="font-semibold text-sm flex items-center gap-2">
            <svg className="w-4 h-4 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
            </svg>
            Notifications
          </h3>

          <div className="flex items-center justify-between py-1 border-b border-border/30 pb-2">
            <span className="text-xs text-muted-foreground">Browser alerts</span>
            {notifPermission === "granted" ? (
              <span className="text-[10px] text-green-400 flex items-center gap-1 font-medium">
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg> ON
              </span>
            ) : notifPermission === "denied" ? (
              <span className="text-[10px] text-red-400">Blocked in browser</span>
            ) : (
              <button onClick={requestNotif} className="text-[10px] px-2.5 py-1 rounded-lg bg-primary/20 text-primary hover:bg-primary/30 transition font-medium">
                Enable
              </button>
            )}
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Email (Resend)</span>
              <span className="text-[10px] text-green-400 font-medium">Ready</span>
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
              {emailSending
                ? <><svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>Sending...</>
                : "Send Test Email"}
            </button>
            {emailStatus && (
              <p className={`text-[10px] text-center font-medium ${emailStatus.ok ? "text-green-400" : "text-red-400"}`}>
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

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium">
                URL Templates <span className="text-xs text-muted-foreground font-normal">(one per line — each checked with every word)</span>
              </label>
              <span className="text-xs text-muted-foreground">{templatesInput.split("\n").filter(Boolean).length} templates</span>
            </div>
            <textarea
              value={templatesInput}
              onChange={e => setTemplatesInput(e.target.value)}
              placeholder={"https://dl.dir.freefiremobile.com/common/Local/IND/config/(Word)-256x107IND_en.png\nhttps://dl.dir.freefiremobile.com/common/Local/IND/config/(Word)-256x107_ru.png"}
              rows={4}
              className="w-full px-4 py-3 rounded-xl bg-input border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 font-mono text-xs transition resize-none"
            />
            <p className="text-[10px] text-muted-foreground mt-1">
              Use <code className="text-primary bg-primary/10 px-1 rounded">(Word)</code> as the placeholder — it gets replaced with each word below
            </p>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium">Words List <span className="text-xs text-muted-foreground font-normal">(one per line)</span></label>
              <span className="text-xs text-muted-foreground">{wordsInput.split("\n").filter(Boolean).length} words</span>
            </div>
            <textarea
              value={wordsInput}
              onChange={e => setWordsInput(e.target.value)}
              placeholder={"OB54\nOB55\nOB56\nSeason1"}
              rows={4}
              className="w-full px-4 py-3 rounded-xl bg-input border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 font-mono text-sm transition resize-none"
            />
          </div>

          {/* Summary */}
          {templatesInput.split("\n").filter(Boolean).length > 0 && wordsInput.split("\n").filter(Boolean).length > 0 && (
            <div className="bg-primary/5 border border-primary/20 rounded-xl px-4 py-2.5 flex items-center gap-3">
              <svg className="w-4 h-4 text-primary shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 11h.01M12 11h.01M15 11h.01M4 19h16a2 2 0 002-2V7a2 2 0 00-2-2H4a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
              <span className="text-xs text-muted-foreground">
                Will check <strong className="text-foreground">{templatesInput.split("\n").filter(Boolean).length * wordsInput.split("\n").filter(Boolean).length}</strong> URLs
                ({templatesInput.split("\n").filter(Boolean).length} templates × {wordsInput.split("\n").filter(Boolean).length} words)
              </span>
            </div>
          )}

          {/* Loop */}
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
                  <button key={m} onClick={() => setLoopInterval(m)}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${loopInterval === m ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-secondary"}`}>
                    {m}m
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex gap-3 flex-wrap">
            {!isChecking ? (
              <button onClick={() => startCheck()} className="px-6 py-3 rounded-xl bg-primary text-primary-foreground font-semibold hover:opacity-90 active:scale-[0.98] transition-all glow-primary flex items-center gap-2">
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
                Stop
              </button>
            )}
            {loopCountdown > 0 && (
              <button onClick={stopLoop} className="px-4 py-3 rounded-xl bg-muted text-muted-foreground font-medium hover:bg-secondary transition text-sm flex items-center gap-2">
                <svg className="w-3.5 h-3.5 text-primary animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                </svg>
                <span className="text-primary font-mono font-bold">{formatCountdown(loopCountdown)}</span>
                <span>next check · Stop Loop</span>
              </button>
            )}
          </div>
        </div>

        {/* Results */}
        {(isChecking || results.length > 0) && (
          <div className="glass rounded-2xl p-5">
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
                <div className="w-2 h-2 rounded-full bg-muted-foreground/60" />
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

            <div className="space-y-2 max-h-[500px] overflow-y-auto">
              {results.map((r, i) => (
                <div key={i} className={`flex gap-3 p-3 rounded-xl transition-all duration-200 ${
                  r.status === "working" ? "bg-green-500/10 border border-green-500/25" :
                  r.status === "dead" ? "bg-red-500/5 border border-red-500/10" :
                  r.status === "checking" ? "bg-primary/5 border border-primary/20 animate-pulse-slow" :
                  "bg-muted/30 border border-border/40"
                }`}>
                  {/* Status Icon */}
                  <div className="shrink-0 mt-0.5">
                    {r.status === "working" && <div className="w-6 h-6 rounded-full bg-green-500/20 flex items-center justify-center"><svg className="w-3.5 h-3.5 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg></div>}
                    {r.status === "dead" && <div className="w-6 h-6 rounded-full bg-red-500/20 flex items-center justify-center"><svg className="w-3.5 h-3.5 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" /></svg></div>}
                    {r.status === "checking" && <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center"><svg className="w-3.5 h-3.5 text-primary animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg></div>}
                    {r.status === "pending" && <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center"><div className="w-1.5 h-1.5 rounded-full bg-muted-foreground/50" /></div>}
                  </div>

                  {/* Image Preview */}
                  {r.status === "working" && r.previewUrl && (
                    <div className="shrink-0">
                      <img
                        src={r.previewUrl}
                        alt={r.word}
                        className="w-14 h-10 object-cover rounded-lg border border-green-500/20"
                        onError={e => { (e.target as HTMLImageElement).style.display = "none"; }}
                      />
                    </div>
                  )}

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-xs font-bold text-foreground">{r.word}</span>
                      {r.responseTime !== undefined && (
                        <span className={`text-[10px] font-mono ${r.responseTime < 1000 ? "text-green-400" : r.responseTime < 3000 ? "text-yellow-400" : "text-muted-foreground"}`}>
                          {r.responseTime}ms
                        </span>
                      )}
                      {r.checkedAt && (
                        <span className="text-[10px] text-muted-foreground">{fmt12h(r.checkedAt)}</span>
                      )}
                    </div>
                    <p className="text-[10px] text-muted-foreground truncate font-mono mt-0.5">{r.url}</p>
                  </div>

                  {r.status === "working" && (
                    <a href={r.url} target="_blank" rel="noopener noreferrer"
                      className="shrink-0 self-center text-xs text-green-400 hover:text-green-300 font-medium transition">
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
