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

export interface SchemaProperty {
  type?: string | string[];
  description?: string;
  enum?: unknown[];
  default?: unknown;
  items?: SchemaProperty;
  properties?: Record<string, SchemaProperty>;
  required?: string[];
  minimum?: number;
  maximum?: number;
  minLength?: number;
  maxLength?: number;
}

export interface MCPToolSchema {
  type?: string;
  properties?: Record<string, SchemaProperty>;
  required?: string[];
  description?: string;
}

export interface MCPTool {
  name: string;
  description?: string;
  inputSchema?: MCPToolSchema;
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

// Build a stub JSON args object from a tool schema
export function buildStub(tool: MCPTool): string {
  const props = tool.inputSchema?.properties ?? {};
  const required = tool.inputSchema?.required ?? [];

  const stub: Record<string, unknown> = {};

  for (const [k, v] of Object.entries(props)) {
    const prop = v as SchemaProperty;

    // Use default if provided
    if (prop.default !== undefined) {
      stub[k] = prop.default;
      continue;
    }

    // Determine type
    const rawType = prop.type;
    const type = Array.isArray(rawType)
      ? (rawType.find((t) => t !== "null") ?? "string")
      : (rawType ?? "string");

    // Use enum first value if available
    if (prop.enum && prop.enum.length > 0) {
      stub[k] = prop.enum[0];
      continue;
    }

    // Type-appropriate defaults
    if (type === "number" || type === "integer") stub[k] = required.includes(k) ? 1 : 0;
    else if (type === "boolean") stub[k] = false;
    else if (type === "array") stub[k] = [];
    else if (type === "object") stub[k] = {};
    else stub[k] = ""; // string / any / unknown
  }

  return JSON.stringify(stub, null, 2);
}
