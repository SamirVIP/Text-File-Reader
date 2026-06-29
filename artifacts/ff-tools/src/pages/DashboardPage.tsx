import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import URLChecker from "@/components/URLChecker";
import LinkMaker from "@/components/LinkMaker";

type Tool = "url-checker" | "link-maker";

export default function DashboardPage() {
  const { user, logout } = useAuth();
  const [activeTool, setActiveTool] = useState<Tool>("url-checker");

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="glass border-b border-border/60 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-primary/20 border border-primary/30 flex items-center justify-center">
              <svg className="w-4 h-4 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
              </svg>
            </div>
            <span className="font-bold text-gradient text-lg">FF Tools</span>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground hidden sm:block">
              {user?.name}
            </span>
            <button
              onClick={logout}
              className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition px-3 py-1.5 rounded-lg hover:bg-muted"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              Sign Out
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-7xl mx-auto w-full px-4 py-6 space-y-6">
        {/* Tool Navigation */}
        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={() => setActiveTool("url-checker")}
            className={`flex items-center gap-2.5 px-5 py-2.5 rounded-xl font-medium text-sm transition-all duration-150 ${
              activeTool === "url-checker"
                ? "bg-primary text-primary-foreground glow-primary"
                : "glass text-muted-foreground hover:text-foreground hover:bg-secondary"
            }`}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            URL Checker
            <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-mono ${activeTool === "url-checker" ? "bg-white/20" : "bg-muted"}`}>
              Tool 1
            </span>
          </button>

          <button
            onClick={() => setActiveTool("link-maker")}
            className={`flex items-center gap-2.5 px-5 py-2.5 rounded-xl font-medium text-sm transition-all duration-150 ${
              activeTool === "link-maker"
                ? "bg-primary text-primary-foreground glow-primary"
                : "glass text-muted-foreground hover:text-foreground hover:bg-secondary"
            }`}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
            </svg>
            Link Maker
            <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-mono ${activeTool === "link-maker" ? "bg-white/20" : "bg-muted"}`}>
              Tool 2
            </span>
          </button>

          <div className="ml-auto">
            <a
              href="https://lof-tools-ff.vercel.app/"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-medium text-sm glass text-muted-foreground hover:text-foreground hover:bg-secondary transition-all duration-150 border border-primary/20 hover:border-primary/40"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
              More Tools
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
            </a>
          </div>
        </div>

        {/* Tool Header */}
        <div className="glass rounded-2xl p-5 border border-border/60">
          {activeTool === "url-checker" ? (
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-xl bg-primary/20 border border-primary/30 flex items-center justify-center shrink-0">
                <svg className="w-5 h-5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <h2 className="font-bold text-lg text-foreground">Python URL Checker (Loop)</h2>
                <p className="text-sm text-muted-foreground mt-0.5">
                  Enter a URL template with <code className="text-primary bg-primary/10 px-1.5 py-0.5 rounded text-xs font-mono">(Word)</code> placeholder. Add your word list and check all URLs instantly. Sessions are auto-saved to history and can loop automatically every 5, 10, or 15 minutes.
                </p>
              </div>
            </div>
          ) : (
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-xl bg-primary/20 border border-primary/30 flex items-center justify-center shrink-0">
                <svg className="w-5 h-5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                </svg>
              </div>
              <div>
                <h2 className="font-bold text-lg text-foreground">Link Maker</h2>
                <p className="text-sm text-muted-foreground mt-0.5">
                  Upload an image or paste a URL to generate a CDN link. Choose your path, rename the file, select format (.jpg/.png), and copy your link instantly.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Active Tool */}
        {activeTool === "url-checker" ? <URLChecker /> : <LinkMaker />}
      </main>

      {/* Footer */}
      <footer className="border-t border-border/40 py-4 px-4 text-center text-xs text-muted-foreground">
        <span>FF Tools — URL Checker & Link Maker Suite</span>
        <span className="mx-2">·</span>
        <a href="https://lof-tools-ff.vercel.app/" target="_blank" rel="noopener noreferrer" className="hover:text-primary transition">More Tools</a>
      </footer>
    </div>
  );
}
