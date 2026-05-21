import { useState, useCallback } from "react";
import type { MCPServer, MCPTool, InspectResult } from "./api";
import { searchServers, inspectServer, callTool, buildStub } from "./api";
import { AuthWizard } from "./AuthWizard";
import { SchemaViewer } from "./SchemaViewer";
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
  const [activeTool, setActiveTool] = useState<MCPTool | null>(null);

  // Test
  const [testCmd, setTestCmd] = useState("");
  const [testTool, setTestTool] = useState<MCPTool | null>(null);
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
    const command = (cmd ?? inspectCmd).trim();
    if (!command) return;
    setInspectCmd(command);
    setInspecting(true);
    setInspectResult(null);
    setInspectError("");
    setActiveTool(null);
    setView("inspect");
    try {
      const res = await inspectServer(command);
      setInspectResult(res);
      setTestCmd(command);
      // Auto-select first tool
      if (res.tools.length > 0) setActiveTool(res.tools[0]);
    } catch (e) {
      setInspectError(e instanceof Error ? e.message : String(e));
    } finally {
      setInspecting(false);
    }
  }, [inspectCmd]);

  const goToTest = useCallback((tool: MCPTool, cmd: string) => {
    setTestTool(tool);
    setTestCmd(cmd);
    setToolArgs(buildStub(tool));
    setTestResult("");
    setTestError("");
    setView("test");
  }, []);

  const doTest = useCallback(async () => {
    if (!testCmd.trim() || !testTool) return;
    setTesting(true);
    setTestResult("");
    setTestError("");
    let args: Record<string, unknown> = {};
    try {
      args = JSON.parse(toolArgs || "{}");
    } catch {
      setTestError("Invalid JSON — check your arguments");
      setTesting(false);
      return;
    }
    try {
      const res = await callTool(testCmd, testTool.name, args);
      const text = res.content
        .filter((b) => b.type === "text")
        .map((b) => b.text ?? "")
        .join("\n");
      setTestResult(text || JSON.stringify(res.content, null, 2));
    } catch (e) {
      setTestError(e instanceof Error ? e.message : String(e));
    } finally {
      setTesting(false);
    }
  }, [testCmd, testTool, toolArgs]);

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
          onConnect={(cmd) => { setWizardServer(null); doInspect(cmd); }}
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

        {/* ── REGISTRY ── */}
        {view === "registry" && (
          <section className="panel">
            <div className="panel-header">
              <h2 className="panel-title">Registry</h2>
              <p className="panel-sub">
                {servers.length > 0 ? `${servers.length} servers found` : "156 MCP servers"} — click any to inspect
              </p>
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
                <div key={s.name} className="server-card" onClick={() => handleServerClick(s)}>
                  <div className="server-top">
                    <span className="server-name">{s.name}</span>
                    <div className="server-tags">
                      {s.env && s.env.length > 0 && (
                        <span className="tag tag-auth">🔑 auth</span>
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

        {/* ── INSPECT ── */}
        {view === "inspect" && (
          <section className="panel">
            <div className="panel-header">
              <h2 className="panel-title">Inspect</h2>
              <p className="panel-sub">Click a tool to see its schema, then test it</p>
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
            {inspecting && <div className="empty">Connecting to server...</div>}

            {inspectResult && (
              <div className="inspect-layout">
                {/* Left: tool list */}
                <div className="inspect-left">
                  <div className="section-label">
                    tools <span className="count">{inspectResult.tools.length}</span>
                  </div>
                  <div className="tool-list">
                    {inspectResult.tools.map((tool) => (
                      <div
                        key={tool.name}
                        className={`tool-list-item ${activeTool?.name === tool.name ? "active" : ""}`}
                        onClick={() => setActiveTool(tool)}
                      >
                        <div className="tool-list-name">{tool.name}</div>
                        {tool.description && (
                          <div className="tool-list-desc">{tool.description}</div>
                        )}
                      </div>
                    ))}
                  </div>

                  {inspectResult.resources.length > 0 && (
                    <>
                      <div className="section-label" style={{ marginTop: 20 }}>
                        resources <span className="count">{inspectResult.resources.length}</span>
                      </div>
                      {inspectResult.resources.map((r) => (
                        <div key={r.name + r.uri} className="resource-row">
                          <span className="resource-name">{r.name}</span>
                          <span className="resource-uri">{r.uri}</span>
                        </div>
                      ))}
                    </>
                  )}
                </div>

                {/* Right: schema */}
                <div className="inspect-right">
                  {activeTool ? (
                    <>
                      <SchemaViewer
                        name={activeTool.name}
                        schema={activeTool.inputSchema}
                        description={activeTool.description}
                      />
                      <button
                        className="run-btn"
                        style={{ marginTop: 12, width: "100%", padding: "10px" }}
                        onClick={() => goToTest(activeTool, inspectCmd)}
                      >
                        Test this tool →
                      </button>
                    </>
                  ) : (
                    <div className="schema-placeholder">
                      <span>←</span>
                      <p>Select a tool to see its schema</p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </section>
        )}

        {/* ── TEST ── */}
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
                  value={testTool?.name ?? ""}
                  onChange={(e) => setTestTool({ name: e.target.value })}
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
                <button
                  className="run-btn wide"
                  onClick={doTest}
                  disabled={testing || !testCmd.trim() || !testTool?.name}
                >
                  {testing ? "calling..." : "▶ run"}
                </button>
              </div>
              <div className="test-right">
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                  <label className="field-label" style={{ margin: 0 }}>Result</label>
                  {testResult && (
                    <button
                      className="cancel-btn"
                      style={{ fontSize: 11, padding: "3px 10px" }}
                      onClick={() => navigator.clipboard.writeText(testResult)}
                    >
                      copy
                    </button>
                  )}
                </div>
                {testError && <div className="error-box">{testError}</div>}
                <pre className="result-box">
                  {testResult || "// output will appear here"}
                </pre>
              </div>
            </div>
          </section>
        )}

      </main>
    </div>
  );
}
