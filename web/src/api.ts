export interface EnvVar {
  name: string;
  description: string;
  required: boolean;
  url?: string;
}

export interface MCPServer {
  name: string;
  description: string;
  url: string;
  tags: string[];
  author?: string;
  license?: string;
  env?: EnvVar[];
}

export interface MCPTool {
  name: string;
  description?: string;
  inputSchema?: { properties?: Record<string, unknown> };
}

export interface MCPResource {
  name: string;
  uri: string;
}

export interface InspectResult {
  tools: MCPTool[];
  resources: MCPResource[];
  prompts: { name: string; description?: string }[];
}

export interface TestResult {
  content: { type: string; text?: string }[];
}

const BASE =
  typeof window !== "undefined" && window.location.port === "4242"
    ? "http://localhost:7070/api"
    : "/api";

async function apiFetch(url: string, init?: RequestInit): Promise<Response> {
  const res = await fetch(url, init);
  if (!res.ok) {
    let msg: string;
    try { msg = await res.text(); } catch { msg = res.statusText; }
    throw new Error(msg);
  }
  return res;
}

export async function searchServers(query?: string, tag?: string): Promise<MCPServer[]> {
  const params = new URLSearchParams();
  if (query) params.set("q", query);
  if (tag) params.set("tag", tag);
  const res = await apiFetch(`${BASE}/search?${params}`);
  return res.json();
}

export async function inspectServer(command: string): Promise<InspectResult> {
  const res = await apiFetch(`${BASE}/inspect`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ command }),
  });
  return res.json();
}

export async function callTool(
  command: string,
  tool: string,
  args: Record<string, unknown>
): Promise<TestResult> {
  const res = await apiFetch(`${BASE}/test`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ command, tool, args }),
  });
  return res.json();
}
