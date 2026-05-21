import { useState, useCallback } from "react";
import type { MCPServer, MCPTool, InspectResult, Collection, CollectionStep, CollectionStepResult } from "./api";
import {
  searchServers, inspectServer, inspectMultiple, callTool, buildStub,
  runCollection, loadCollections, saveCollections, createCollection,
} from "./api";
import { AuthWizard } from "./AuthWizard";
import { SchemaViewer } from "./SchemaViewer";
import "./App.css";

type View = "registry" | "inspect" | "test" | "collections";

// ── Multi-server session ──────────────────────────────────────────────────────
interface ServerSession {
  id: string;
  command: string;
  label: string;
  status: "loading" | "ok" | "error";
  result?: InspectResult;
  error?: string;
}

function shortLabel(cmd: string): string {
  const parts = cmd.trim().split(/\s+/);
  const pkg = parts.find((p) => p.startsWith("@") || (!p.startsWith("-") && p !== "npx" && p !== "-y"));
  if (pkg) return pkg.split("/").pop()?.split("@")[0] ?? pkg;
  return parts[parts.length - 1] ?? cmd;
}

export default function App() {
  const [view, setView] = useState<View>("registry");

  // Registry
  const [query, setQuery] = useState("");
  const [servers, setServers] = useState<MCPServer[]>([]);
  const [searching, setSearching] = useState(false);
  const [wizardServer, setWizardServer] = useState<MCPServer | null>(null);

  // Multi-server Inspect
  const [sessions, setSessions] = useState<ServerSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [newCmd, setNewCmd] = useState("");
  const [activeTool, setActiveTool] = useState<MCPTool | null>(null);

  // Test
  const [testCmd, setTestCmd] = useState("");
  const [testTool, setTestTool] = useState<MCPTool | null>(null);
  const [toolArgs, setToolArgs] = useState("{}");
  const [testResult, setTestResult] = useState("");
  const [testing, setTesting] = useState(false);
  const [testError, setTestError] = useState("");

  // Collections
  const [collections, setCollections] = useState<Collection[]>(() => loadCollections());
  const [activeCollection, setActiveCollection] = useState<Collection | null>(null);
  const [collectionName, setCollectionName] = useState("");
  const [runResults, setRunResults] = useState<CollectionStepResult[] | null>(null);
  const [running, setRunning] = useState(false);
  const [editingStep, setEditingStep] = useState<CollectionStep | null>(null);

  // ── Helpers ──────────────────────────────────────────────────────────────────

  const persistCollections = useCallback((cols: Collection[]) => {
    setCollections(cols);
    saveCollections(cols);
  }, []);

  const doSearch = useCallback(async () => {
    setSearching(true);
    try {
      const res = await searchServers(query || undefined);
      setServers(res);
    } catch { setServers([]); }
    finally { setSearching(false); }
  }, [query]);

  // Add a server session tab
  const addSession = useCallback(async (cmd: string) => {
    const id = crypto.randomUUID();
    const session: ServerSession = { id, command: cmd, label: shortLabel(cmd), status: "loading" };
    setSessions((prev) => [...prev, session]);
    setActiveSessionId(id);
    setActiveTool(null);
    setView("inspect");

    try {
      const result = await inspectServer(cmd);
      setSessions((prev) =>
        prev.map((s) => s.id === id ? { ...s, status: "ok", result } : s)
      );
      if (result.tools.length > 0) setActiveTool(result.tools[0]);
    } catch (e) {
      const error = e instanceof Error ? e.message : String(e);
      setSessions((prev) => prev.map((s) => s.id === id ? { ...s, status: "error", error } : s));
    }
  }, []);

  const removeSession = useCallback((id: string) => {
    setSessions((prev) => {
      const next = prev.filter((s) => s.id !== id);
      if (activeSessionId === id) {
        setActiveSessionId(next[next.length - 1]?.id ?? null);
        setActiveTool(null);
      }
      return next;
    });
  }, [activeSessionId]);

  const activeSession = sessions.find((s) => s.id === activeSessionId) ?? null;

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
    setTesting(true); setTestResult(""); setTestError("");
    let args: Record<string, unknown> = {};
    try { args = JSON.parse(toolArgs || "{}"); }
    catch { setTestError("Invalid JSON — check your arguments"); setTesting(false); return; }
    try {
      const res = await callTool(testCmd, testTool.name, args);
      const text = res.content.filter((b) => b.type === "text").map((b) => b.text ?? "").join("\n");
      setTestResult(text || JSON.stringify(res.content, null, 2));
    } catch (e) { setTestError(e instanceof Error ? e.message : String(e)); }
    finally { setTesting(false); }
  }, [testCmd, testTool, toolArgs]);

  // Save current test as a collection step
  const saveAsStep = useCallback(() => {
    if (!testTool || !testCmd) return;
    let args: Record<string, unknown> = {};
    try { args = JSON.parse(toolArgs || "{}"); } catch {}

    const step: CollectionStep = {
      id: crypto.randomUUID(),
      command: testCmd,
      tool: testTool.name,
      args,
      label: `${shortLabel(testCmd)} → ${testTool.name}`,
    };

    if (activeCollection) {
      const updated = { ...activeCollection, steps: [...activeCollection.steps, step] };
      setActiveCollection(updated);
      persistCollections(collections.map((c) => c.id === updated.id ? updated : c));
    } else {
      // Create new collection with this step
      const col = createCollection("New Collection", [step]);
      persistCollections([...collections, col]);
      setActiveCollection(col);
    }
    setView("collections");
  }, [testTool, testCmd, toolArgs, activeCollection, collections, persistCollections]);

  // ── Collections logic ─────────────────────────────────────────────────────────

  const doRunCollection = useCallback(async (col: Collection) => {
    if (col.steps.length === 0) return;
    setRunning(true); setRunResults(null);
    try {
      const res = await runCollection(col.steps.map((s) => ({ command: s.command, tool: s.tool, args: s.args })));
      setRunResults(res.steps);
    } catch (e) { console.error(e); }
    finally { setRunning(false); }
  }, []);

  function handleServerClick(s: MCPServer) {
    if (s.env && s.env.length > 0) { setWizardServer(s); }
    else { addSession(`npx -y ${s.name}`); }
  }

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <div className="shell">
      {wizardServer && (
        <AuthWizard
          server={wizardServer}
          onConnect={(cmd) => { setWizardServer(null); addSession(cmd); }}
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
          {(["registry", "inspect", "test", "collections"] as View[]).map((v) => (
            <button
              key={v}
              className={`nav-btn ${view === v ? "active" : ""}`}
              onClick={() => setView(v)}
            >
              {v}
              {v === "inspect" && sessions.length > 0 && (
                <span className="nav-badge">{sessions.length}</span>
              )}
              {v === "collections" && collections.length > 0 && (
                <span className="nav-badge">{collections.length}</span>
              )}
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
                      {s.env && s.env.length > 0 && <span className="tag tag-auth">🔑 auth</span>}
                      {s.tags.map((t) => <span key={t} className="tag">{t}</span>)}
                    </div>
                  </div>
                  <p className="server-desc">{s.description}</p>
                  {s.author && <span className="server-author">by {s.author}</span>}
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ── INSPECT (multi-server) ── */}
        {view === "inspect" && (
          <section className="panel">
            <div className="panel-header">
              <h2 className="panel-title">Inspect</h2>
              <p className="panel-sub">Connect multiple servers simultaneously — each gets its own tab</p>
            </div>

            {/* Add server row */}
            <div className="search-row">
              <span className="prompt-sym">›</span>
              <input
                className="cmd-input"
                placeholder="npx -y @scope/mcp-server [args]"
                value={newCmd}
                onChange={(e) => setNewCmd(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && newCmd.trim()) { addSession(newCmd.trim()); setNewCmd(""); } }}
                autoFocus
              />
              <button
                className="run-btn"
                onClick={() => { if (newCmd.trim()) { addSession(newCmd.trim()); setNewCmd(""); } }}
              >
                + connect
              </button>
            </div>

            {sessions.length === 0 && (
              <div className="empty">Paste a server command and hit connect</div>
            )}

            {sessions.length > 0 && (
              <>
                {/* Session tabs */}
                <div className="session-tabs">
                  {sessions.map((s) => (
                    <div
                      key={s.id}
                      className={`session-tab ${activeSessionId === s.id ? "active" : ""} ${s.status}`}
                      onClick={() => { setActiveSessionId(s.id); setActiveTool(s.result?.tools[0] ?? null); }}
                    >
                      <span className="session-tab-dot" />
                      <span className="session-tab-label">{s.label}</span>
                      <button
                        className="session-tab-close"
                        onClick={(e) => { e.stopPropagation(); removeSession(s.id); }}
                      >×</button>
                    </div>
                  ))}
                </div>

                {/* Active session content */}
                {activeSession && (
                  <>
                    {activeSession.status === "loading" && (
                      <div className="empty">Connecting to {activeSession.command}…</div>
                    )}
                    {activeSession.status === "error" && (
                      <div className="error-box">{activeSession.error}</div>
                    )}
                    {activeSession.status === "ok" && activeSession.result && (
                      <div className="inspect-layout">
                        <div className="inspect-left">
                          <div className="section-label">
                            tools <span className="count">{activeSession.result.tools.length}</span>
                          </div>
                          <div className="tool-list">
                            {activeSession.result.tools.map((tool) => (
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
                          {activeSession.result.resources.length > 0 && (
                            <>
                              <div className="section-label" style={{ marginTop: 20 }}>
                                resources <span className="count">{activeSession.result.resources.length}</span>
                              </div>
                              {activeSession.result.resources.map((r) => (
                                <div key={r.name + r.uri} className="resource-row">
                                  <span className="resource-name">{r.name}</span>
                                  <span className="resource-uri">{r.uri}</span>
                                </div>
                              ))}
                            </>
                          )}
                        </div>
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
                                onClick={() => goToTest(activeTool, activeSession.command)}
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
                  </>
                )}
              </>
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
                <div style={{ display: "flex", gap: 8 }}>
                  <button
                    className="run-btn wide"
                    onClick={doTest}
                    disabled={testing || !testCmd.trim() || !testTool?.name}
                  >
                    {testing ? "calling..." : "▶ run"}
                  </button>
                  <button
                    className="cancel-btn"
                    style={{ flex: "0 0 auto", padding: "10px 16px", fontSize: 12 }}
                    onClick={saveAsStep}
                    disabled={!testTool?.name || !testCmd.trim()}
                    title="Save to collections"
                  >
                    + save to collection
                  </button>
                </div>
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
                <pre className="result-box">{testResult || "// output will appear here"}</pre>
              </div>
            </div>
          </section>
        )}

        {/* ── COLLECTIONS ── */}
        {view === "collections" && (
          <section className="panel">
            <div className="panel-header">
              <h2 className="panel-title">Collections</h2>
              <p className="panel-sub">Save and replay sequences of tool calls</p>
            </div>

            <div style={{ display: "flex", gap: 24 }}>
              {/* Left — list of collections */}
              <div style={{ width: 220, flexShrink: 0 }}>
                <div className="section-label" style={{ marginBottom: 10 }}>
                  saved <span className="count">{collections.length}</span>
                </div>
                {collections.length === 0 && (
                  <div className="empty" style={{ fontSize: 12 }}>
                    No collections yet.<br />Run a tool and click<br />"+ save to collection".
                  </div>
                )}
                {collections.map((col) => (
                  <div
                    key={col.id}
                    className={`tool-list-item ${activeCollection?.id === col.id ? "active" : ""}`}
                    onClick={() => { setActiveCollection(col); setRunResults(null); }}
                    style={{ cursor: "pointer" }}
                  >
                    <div className="tool-list-name">{col.name}</div>
                    <div className="tool-list-desc">{col.steps.length} step{col.steps.length !== 1 ? "s" : ""}</div>
                  </div>
                ))}

                <div style={{ marginTop: 16, display: "flex", gap: 8 }}>
                  <input
                    className="cmd-input"
                    style={{ background: "var(--bg2)", border: "1px solid var(--border)", borderRadius: 6, padding: "8px 10px", fontSize: 12, flex: 1 }}
                    placeholder="new collection name"
                    value={collectionName}
                    onChange={(e) => setCollectionName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && collectionName.trim()) {
                        const col = createCollection(collectionName.trim());
                        persistCollections([...collections, col]);
                        setActiveCollection(col);
                        setCollectionName("");
                        setRunResults(null);
                      }
                    }}
                  />
                  <button
                    className="run-btn"
                    style={{ padding: "8px 12px", fontSize: 12 }}
                    onClick={() => {
                      if (!collectionName.trim()) return;
                      const col = createCollection(collectionName.trim());
                      persistCollections([...collections, col]);
                      setActiveCollection(col);
                      setCollectionName("");
                      setRunResults(null);
                    }}
                  >+</button>
                </div>
              </div>

              {/* Right — active collection detail */}
              <div style={{ flex: 1, minWidth: 0 }}>
                {!activeCollection ? (
                  <div className="schema-placeholder">
                    <span>←</span>
                    <p>Select a collection to view its steps</p>
                  </div>
                ) : (
                  <>
                    <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
                      <input
                        className="cmd-input"
                        style={{ background: "var(--bg2)", border: "1px solid var(--border)", borderRadius: 6, padding: "8px 12px", fontSize: 14, fontWeight: 500, flex: 1 }}
                        value={activeCollection.name}
                        onChange={(e) => {
                          const updated = { ...activeCollection, name: e.target.value };
                          setActiveCollection(updated);
                          persistCollections(collections.map((c) => c.id === updated.id ? updated : c));
                        }}
                      />
                      <button
                        className="run-btn"
                        style={{ padding: "8px 18px" }}
                        disabled={running || activeCollection.steps.length === 0}
                        onClick={() => doRunCollection(activeCollection)}
                      >
                        {running ? "running…" : "▶ run all"}
                      </button>
                      <button
                        className="cancel-btn"
                        style={{ padding: "8px 12px", fontSize: 12, color: "var(--error, #e05)" }}
                        onClick={() => {
                          persistCollections(collections.filter((c) => c.id !== activeCollection.id));
                          setActiveCollection(null);
                          setRunResults(null);
                        }}
                      >
                        delete
                      </button>
                    </div>

                    {activeCollection.steps.length === 0 ? (
                      <div className="empty" style={{ fontSize: 12 }}>
                        No steps yet. Go to Test tab, run a tool, then click "+ save to collection".
                      </div>
                    ) : (
                      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                        {activeCollection.steps.map((step, i) => {
                          const stepResult = runResults?.[i];
                          return (
                            <div key={step.id} className="collection-step">
                              <div className="collection-step-header">
                                <span className="collection-step-num">{i + 1}</span>
                                <div style={{ flex: 1 }}>
                                  <div className="collection-step-label">
                                    {step.label || `${shortLabel(step.command)} → ${step.tool}`}
                                  </div>
                                  <div className="collection-step-meta">
                                    <span className="tool-chip">{step.tool}</span>
                                    <span className="cmd-chip">{shortLabel(step.command)}</span>
                                  </div>
                                </div>
                                <div style={{ display: "flex", gap: 6 }}>
                                  <button
                                    className="cancel-btn"
                                    style={{ fontSize: 11, padding: "3px 8px" }}
                                    onClick={() => {
                                      setTestTool({ name: step.tool });
                                      setTestCmd(step.command);
                                      setToolArgs(JSON.stringify(step.args, null, 2));
                                      setTestResult("");
                                      setTestError("");
                                      setView("test");
                                    }}
                                  >edit</button>
                                  <button
                                    className="cancel-btn"
                                    style={{ fontSize: 11, padding: "3px 8px" }}
                                    onClick={() => {
                                      const updated = { ...activeCollection, steps: activeCollection.steps.filter((_, j) => j !== i) };
                                      setActiveCollection(updated);
                                      persistCollections(collections.map((c) => c.id === updated.id ? updated : c));
                                    }}
                                  >×</button>
                                </div>
                              </div>

                              {stepResult && (
                                <div className={`collection-step-result ${stepResult.error ? "is-error" : "is-ok"}`}>
                                  {stepResult.error ? (
                                    <span className="result-error">✗ {stepResult.error}</span>
                                  ) : (
                                    <>
                                      <span className="result-ok">✓ {stepResult.durationMs}ms</span>
                                      <pre className="result-snippet">
                                        {stepResult.result?.content
                                          .filter((b) => b.type === "text")
                                          .map((b) => b.text ?? "")
                                          .join("\n")
                                          .slice(0, 200) || "{}"}
                                      </pre>
                                    </>
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          </section>
        )}

      </main>
    </div>
  );
}
