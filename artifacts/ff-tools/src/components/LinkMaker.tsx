import { useState, useRef } from "react";

const PATHS = {
  default: "common/Local/IND/config",
  path2: "common/OB54/CSH",
};

type PathKey = keyof typeof PATHS;
type Format = "jpg" | "png";

interface GeneratedLink {
  url: string;
  filename: string;
  format: Format;
  path: PathKey;
  createdAt: string;
}

export default function LinkMaker() {
  const [mode, setMode] = useState<"file" | "url">("file");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [sourceUrl, setSourceUrl] = useState("");
  const [customName, setCustomName] = useState("");
  const [pathKey, setPathKey] = useState<PathKey>("default");
  const [format, setFormat] = useState<Format>("jpg");
  const [domain, setDomain] = useState("https://dl.dir.freefiremobile.com");
  const [generatedLinks, setGeneratedLinks] = useState<GeneratedLink[]>([]);
  const [preview, setPreview] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSelectedFile(file);
    const rawName = file.name.replace(/\.[^.]+$/, "");
    setCustomName(rawName);
    if (file.type.startsWith("image/")) {
      const reader = new FileReader();
      reader.onload = ev => setPreview(ev.target?.result as string);
      reader.readAsDataURL(file);
    }
  };

  const getFilename = () => {
    const base = customName.trim() || (selectedFile ? selectedFile.name.replace(/\.[^.]+$/, "") : "file");
    const safeName = base.replace(/[^a-zA-Z0-9_\-().]/g, "_");
    return `${safeName}.${format}`;
  };

  const generateLink = () => {
    if (mode === "file" && !selectedFile) return alert("Please select a file first");
    if (mode === "url" && !sourceUrl.trim()) return alert("Please enter a URL");
    if (!domain.trim()) return alert("Please enter a domain");

    const filename = getFilename();
    const pathPart = PATHS[pathKey];
    const cleanDomain = domain.replace(/\/$/, "");
    const url = `${cleanDomain}/${pathPart}/${filename}`;

    const link: GeneratedLink = {
      url,
      filename,
      format,
      path: pathKey,
      createdAt: new Date().toLocaleString(),
    };

    setGeneratedLinks(prev => [link, ...prev]);
  };

  const copyToClipboard = async (text: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(text);
    setTimeout(() => setCopied(null), 2000);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    setSelectedFile(file);
    const rawName = file.name.replace(/\.[^.]+$/, "");
    setCustomName(rawName);
    if (file.type.startsWith("image/")) {
      const reader = new FileReader();
      reader.onload = ev => setPreview(ev.target?.result as string);
      reader.readAsDataURL(file);
    }
  };

  return (
    <div className="flex gap-4 min-h-[500px]">
      {/* Config Panel */}
      <div className="flex-1 space-y-4">
        {/* Mode Switch */}
        <div className="glass rounded-2xl p-5 space-y-4">
          <div className="flex rounded-xl overflow-hidden border border-border">
            <button
              onClick={() => setMode("file")}
              className={`flex-1 py-2.5 text-sm font-medium transition-all duration-150 flex items-center justify-center gap-2 ${mode === "file" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
              Upload Image
            </button>
            <button
              onClick={() => setMode("url")}
              className={`flex-1 py-2.5 text-sm font-medium transition-all duration-150 flex items-center justify-center gap-2 ${mode === "url" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" /></svg>
              From URL
            </button>
          </div>

          {/* File Upload */}
          {mode === "file" && (
            <div
              onClick={() => fileInputRef.current?.click()}
              onDrop={handleDrop}
              onDragOver={e => e.preventDefault()}
              className="border-2 border-dashed border-border rounded-xl p-8 text-center cursor-pointer hover:border-primary/50 hover:bg-primary/5 transition-all group"
            >
              {preview ? (
                <div className="space-y-3">
                  <img src={preview} alt="preview" className="h-32 object-contain mx-auto rounded-lg" />
                  <p className="text-sm text-muted-foreground">{selectedFile?.name}</p>
                  <p className="text-xs text-primary">Click to change</p>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center mx-auto group-hover:bg-primary/20 transition">
                    <svg className="w-6 h-6 text-muted-foreground group-hover:text-primary transition" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                    </svg>
                  </div>
                  <p className="text-sm text-muted-foreground">Drop image here or <span className="text-primary">browse</span></p>
                  <p className="text-xs text-muted-foreground">PNG, JPG, WEBP supported</p>
                </div>
              )}
              <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileChange} className="hidden" />
            </div>
          )}

          {/* URL Input */}
          {mode === "url" && (
            <div>
              <label className="block text-sm font-medium mb-2 text-muted-foreground">Source URL</label>
              <input
                value={sourceUrl}
                onChange={e => { setSourceUrl(e.target.value); if (!customName) { const parts = e.target.value.split("/"); setCustomName(parts[parts.length-1].split("?")[0].replace(/\.[^.]+$/, "")); } }}
                placeholder="https://example.com/image.jpg"
                className="w-full px-4 py-3 rounded-xl bg-input border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 font-mono text-sm transition"
              />
            </div>
          )}
        </div>

        {/* Settings */}
        <div className="glass rounded-2xl p-5 space-y-4">
          <h3 className="font-semibold text-sm">Link Settings</h3>

          {/* Custom Name */}
          <div>
            <label className="block text-sm font-medium mb-2 text-muted-foreground">File Name (without extension)</label>
            <input
              value={customName}
              onChange={e => setCustomName(e.target.value)}
              placeholder="filename"
              className="w-full px-4 py-2.5 rounded-xl bg-input border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 font-mono text-sm transition"
            />
          </div>

          {/* Domain */}
          <div>
            <label className="block text-sm font-medium mb-2 text-muted-foreground">Main Domain</label>
            <input
              value={domain}
              onChange={e => setDomain(e.target.value)}
              placeholder="https://dl.dir.freefiremobile.com"
              className="w-full px-4 py-2.5 rounded-xl bg-input border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 font-mono text-sm transition"
            />
          </div>

          {/* Path Selection */}
          <div>
            <label className="block text-sm font-medium mb-2 text-muted-foreground">Path</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setPathKey("default")}
                className={`p-3 rounded-xl border text-left transition-all ${pathKey === "default" ? "bg-primary/20 border-primary/40 text-primary" : "bg-muted/50 border-border text-muted-foreground hover:border-border hover:bg-muted"}`}
              >
                <p className="text-xs font-semibold">Default Path</p>
                <p className="text-[10px] font-mono mt-1 opacity-75">{PATHS.default}</p>
              </button>
              <button
                onClick={() => setPathKey("path2")}
                className={`p-3 rounded-xl border text-left transition-all ${pathKey === "path2" ? "bg-primary/20 border-primary/40 text-primary" : "bg-muted/50 border-border text-muted-foreground hover:border-border hover:bg-muted"}`}
              >
                <p className="text-xs font-semibold">Path 2</p>
                <p className="text-[10px] font-mono mt-1 opacity-75">{PATHS.path2}</p>
              </button>
            </div>
          </div>

          {/* Format */}
          <div>
            <label className="block text-sm font-medium mb-2 text-muted-foreground">Format</label>
            <div className="flex gap-2">
              {(["jpg", "png"] as const).map(f => (
                <button
                  key={f}
                  onClick={() => setFormat(f)}
                  className={`px-6 py-2.5 rounded-xl border font-medium text-sm transition-all ${format === f ? "bg-primary/20 border-primary/40 text-primary" : "bg-muted/50 border-border text-muted-foreground hover:bg-muted"}`}
                >
                  .{f.toUpperCase()}
                </button>
              ))}
            </div>
          </div>

          {/* Preview of final link */}
          <div className="bg-muted/50 rounded-xl p-3 border border-border/50">
            <p className="text-xs text-muted-foreground mb-1 font-medium">Preview</p>
            <p className="font-mono text-xs text-foreground break-all">{domain.replace(/\/$/, "")}/{PATHS[pathKey]}/{customName || "filename"}.{format}</p>
          </div>

          <button
            onClick={generateLink}
            className="w-full py-3 rounded-xl bg-primary text-primary-foreground font-semibold hover:opacity-90 active:scale-[0.98] transition-all glow-primary flex items-center justify-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
            </svg>
            Generate Link
          </button>
        </div>
      </div>

      {/* Generated Links */}
      <div className="w-80 shrink-0">
        <div className="glass rounded-2xl p-4 h-full">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-sm">Generated Links</h3>
            {generatedLinks.length > 0 && (
              <button onClick={() => setGeneratedLinks([])} className="text-xs text-muted-foreground hover:text-red-400 transition">Clear All</button>
            )}
          </div>

          {generatedLinks.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 text-center">
              <svg className="w-10 h-10 text-muted-foreground/40 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
              </svg>
              <p className="text-xs text-muted-foreground">No links yet. Configure settings and click Generate.</p>
            </div>
          ) : (
            <div className="space-y-2 max-h-[600px] overflow-y-auto pr-1">
              {generatedLinks.map((link, i) => (
                <div key={i} className="bg-muted/50 rounded-xl p-3 border border-border/50 group">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div>
                      <p className="text-xs font-medium text-foreground">{link.filename}</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">{link.createdAt}</p>
                    </div>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-mono shrink-0 ${link.format === "jpg" ? "bg-orange-500/20 text-orange-400" : "bg-blue-500/20 text-blue-400"}`}>
                      .{link.format}
                    </span>
                  </div>
                  <p className="font-mono text-[10px] text-muted-foreground break-all mb-2">{link.url}</p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => copyToClipboard(link.url)}
                      className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-all ${copied === link.url ? "bg-green-500/20 text-green-400" : "bg-primary/20 text-primary hover:bg-primary/30"}`}
                    >
                      {copied === link.url ? "Copied!" : "Copy Link"}
                    </button>
                    <a
                      href={link.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-3 py-1.5 rounded-lg text-xs font-medium bg-muted text-muted-foreground hover:bg-secondary transition"
                    >
                      ↗
                    </a>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
