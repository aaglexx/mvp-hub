export interface MCPServer {
  name: string;
  description: string;
  url: string;
  tags: string[];
  author?: string;
  license?: string;
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

const BASE = "/api";

export async function searchServers(query?: string, tag?: string): Promise<MCPServer[]> {
  const params = new URLSearchParams();
  if (query) params.set("q", query);
  if (tag) params.set("tag", tag);
  const res = await fetch(`${BASE}/search?${params}`);
  return res.json();
}

export async function inspectServer(command: string): Promise<InspectResult> {
  const res = await fetch(`${BASE}/inspect`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ command }),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function callTool(
  command: string,
  tool: string,
  args: Record<string, unknown>
): Promise<TestResult> {
  const res = await fetch(`${BASE}/test`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ command, tool, args }),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}
