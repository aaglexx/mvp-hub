import { useState, useCallback } from "react";
import type { MCPServer, MCPTool, InspectResult } from "./api";
import { searchServers, inspectServer, callTool } from "./api";
import { AuthWizard } from "./AuthWizard";
import "./App.css";

type View = "registry" | "inspect" | "test";

export default function App() {
  const [view, setView] = useState<View>("registry");

  // Registry
  const [query, setQuery] = useState("");
  const [servers, setServers] = useState<MCPServer[]>([]);
  const [searching, setSearching] = useState(false);
  const [wizardServer, setWizardServer] = useState<MCPServer | null>(null);

  // Inspect
  const [inspectCmd, setInspectCmd] = useState("");
  const [inspecting, setInspecting] = useState(false);
  const [inspectResult, setInspectResult] = useState<InspectResult | null>(null);
  const [inspectError, setInspectError] = useState("");

  // Test
  const [testCmd, setTestCmd] = useState("");
  const [selectedTool, setSelectedTool] = useState<MCPTool | null>(null);
  const [toolArgs, setToolArgs] = useState("{}");
  const [testResult, setTestResult] = useState("");
  const [testing, setTesting] = useState(false);
  const [testError, setTestError] = useState("");

  const doSearch = useCallback(async () => {
    setSearching(true);
    try {
      const res = await searchServers(query || undefined);
      setServers(res);
    } catch {
      setServers([]);
    } finally {
      setSearching(false);
    }
  }, [query]);

  const doInspect = useCallback(async (cmd?: string) => {
    const command = cmd ?? inspectCmd;
    if (!command.trim()) return;
    if (cmd) setInspectCmd(cmd);
    setInspecting(true);
    setInspectResult(null);
    setInspectError("");
    setView("inspect");
    try {
      const res = await inspectServer(command);
      setInspectResult(res);
      setTestCmd(command);
    } catch (e) {
      setInspectError(String(e));
    } finally {
      setInspecting(false);
    }
  }, [inspectCmd]);

  const doTest = useCallback(async () => {
    if (!testCmd || !selectedTool) return;
    setTesting(true);
    setTestResult("");
    setTestError("");
    let args: Record<string, unknown> = {};
    try {
      args = JSON.parse(toolArgs || "{}");
    } catch {
      setTestError("Invalid JSON in args");
      setTesting(false);
      return;
    }
    try {
      const res = await callTool(testCmd, selectedTool.name, args);
      const text = res.content
        .filter((b) => b.type === "text")
        .map((b) => b.text)
        .join("\n");
      setTestResult(text || JSON.stringify(res.content, null, 2));
    } catch (e) {
      setTestError(String(e));
    } finally {
      setTesting(false);
    }
  }, [testCmd, selectedTool, toolArgs]);

  function handleServerClick(s: MCPServer) {
    if (s.env && s.env.length > 0) {
      setWizardServer(s);
    } else {
      doInspect(`npx -y ${s.name}`);
    }
  }

  return (
    <div className="shell">
      {wizardServer && (
        <AuthWizard
          server={wizardServer}
          onConnect={(cmd) => {
            setWizardServer(null);
            doInspect(cmd);
          }}
          onCancel={() => setWizardServer(null)}
        />
      )}

      <header className="topbar">
        <div className="logo">
          <span className="logo-prefix">$</span>
          <span className="logo-name">mcp-man</span>
          <span className="logo-tag">MCP server explorer</span>
        </div>
        <nav className="nav">
          {(["registry", "inspect", "test"] as View[]).map((v) => (
            <button
              key={v}
              className={`nav-btn ${view === v ? "active" : ""}`}
              onClick={() => setView(v)}
            >
              {v}
            </button>
          ))}
        </nav>
      </header>

      <main className="main">
        {view === "registry" && (
          <section className="panel">
            <div className="panel-header">
              <h2 className="panel-title">Registry</h2>
              <p className="panel-sub">Search {servers.length > 0 ? `${servers.length} of 184` : "184"} MCP servers — click any to inspect</p>
            </div>
            <div className="search-row">
              <span className="prompt-sym">›</span>
              <input
                className="cmd-input"
                placeholder="search servers..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && doSearch()}
                autoFocus
              />
              <button className="run-btn" onClick={doSearch} disabled={searching}>
                {searching ? "..." : "search"}
              </button>
            </div>
            <div className="results">
              {servers.length === 0 && !searching && (
                <div className="empty">Press search or Enter to load all servers</div>
              )}
              {servers.map((s) => (
                <div
                  key={s.name}
                  className="server-card"
                  onClick={() => handleServerClick(s)}
                >
                  <div className="server-top">
                    <span className="server-name">{s.name}</span>
                    <div className="server-tags">
                      {s.env && s.env.length > 0 && (
                        <span className="tag tag-auth">🔑 auth required</span>
                      )}
                      {s.tags.map((t) => (
                        <span key={t} className="tag">{t}</span>
                      ))}
                    </div>
                  </div>
                  <p className="server-desc">{s.description}</p>
                  {s.author && <span className="server-author">by {s.author}</span>}
                </div>
              ))}
            </div>
          </section>
        )}

        {view === "inspect" && (
          <section className="panel">
            <div className="panel-header">
              <h2 className="panel-title">Inspect</h2>
              <p className="panel-sub">Connect to an MCP server and explore its tools</p>
            </div>
            <div className="search-row">
              <span className="prompt-sym">›</span>
              <input
                className="cmd-input"
                placeholder="npx -y @scope/mcp-server [args]"
                value={inspectCmd}
                onChange={(e) => setInspectCmd(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && doInspect()}
                autoFocus
              />
              <button className="run-btn" onClick={() => doInspect()} disabled={inspecting}>
                {inspecting ? "connecting..." : "inspect"}
              </button>
            </div>
            {inspectError && <div className="error-box">{inspectError}</div>}
            {inspecting && (
              <div className="empty">Connecting to server...</div>
            )}
            {inspectResult && (
              <div className="inspect-results">
                <div className="section-label">
                  tools <span className="count">{inspectResult.tools.length}</span>
                </div>
                <div className="tool-grid">
                  {inspectResult.tools.map((tool) => (
                    <div
                      key={tool.name}
                      className="tool-card"
                      onClick={() => {
                        setSelectedTool(tool);
                        const params = Object.keys(tool.inputSchema?.properties ?? {});
                        const stub: Record<string, string> = {};
                        params.forEach((p) => (stub[p] = ""));
                        setToolArgs(JSON.stringify(stub, null, 2));
                        setView("test");
                      }}
                    >
                      <div className="tool-name">{tool.name}</div>
                      <div className="tool-desc">{tool.description ?? "—"}</div>
                      {Object.keys(tool.inputSchema?.properties ?? {}).length > 0 && (
                        <div className="tool-params">
                          {Object.keys(tool.inputSchema!.properties!).join(", ")}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
                {inspectResult.resources.length > 0 && (
                  <>
                    <div className="section-label">
                      resources <span className="count">{inspectResult.resources.length}</span>
                    </div>
                    {inspectResult.resources.map((r) => (
                      <div key={r.uri} className="resource-row">
                        <span className="resource-name">{r.name}</span>
                        <span className="resource-uri">{r.uri}</span>
                      </div>
                    ))}
                  </>
                )}
              </div>
            )}
          </section>
        )}

        {view === "test" && (
          <section className="panel">
            <div className="panel-header">
              <h2 className="panel-title">Test</h2>
              <p className="panel-sub">Call a tool with arguments and see the response</p>
            </div>
            <div className="test-layout">
              <div className="test-left">
                <label className="field-label">Server command</label>
                <input
                  className="cmd-input full"
                  value={testCmd}
                  onChange={(e) => setTestCmd(e.target.value)}
                  placeholder="npx -y @scope/mcp-server"
                />
                <label className="field-label">Tool</label>
                <input
                  className="cmd-input full"
                  value={selectedTool?.name ?? ""}
                  onChange={(e) => setSelectedTool({ name: e.target.value })}
                  placeholder="tool_name"
                />
                <label className="field-label">Arguments (JSON)</label>
                <textarea
                  className="args-input"
                  value={toolArgs}
                  onChange={(e) => setToolArgs(e.target.value)}
                  rows={8}
                  spellCheck={false}
                  placeholder="{}"
                />
                <button className="run-btn wide" onClick={doTest} disabled={testing}>
                  {testing ? "calling..." : "▶ run"}
                </button>
              </div>
              <div className="test-right">
                <label className="field-label">Result</label>
                {testError && <div className="error-box">{testError}</div>}
                <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 6 }}>
                  {testResult && (
                    <button
                      className="cancel-btn"
                      style={{ fontSize: 11, padding: "4px 12px" }}
                      onClick={() => navigator.clipboard.writeText(testResult)}
                    >
                      copy
                    </button>
                  )}
                </div>
                <pre className="result-box">{testResult || "// output will appear here"}</pre>
              </div>
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
