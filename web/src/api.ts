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
  command: string;
  tools: MCPTool[];
  resources: MCPResource[];
  prompts: { name: string; description?: string }[];
  error?: string;
}

export interface TestResult {
  content: { type: string; text?: string }[];
}

// Collections
export interface CollectionStep {
  id: string;
  command: string;
  tool: string;
  args: Record<string, unknown>;
  label?: string;
}

export interface Collection {
  id: string;
  name: string;
  steps: CollectionStep[];
  createdAt: number;
}

export interface CollectionStepResult {
  command: string;
  tool: string;
  args: Record<string, unknown>;
  result: TestResult | null;
  durationMs: number;
  error: string | null;
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
  const data = await res.json();
  return { ...data, command };
}

export async function inspectMultiple(commands: string[]): Promise<InspectResult[]> {
  const res = await apiFetch(`${BASE}/inspect-multi`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ commands }),
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

export async function runCollection(
  steps: { command: string; tool: string; args: Record<string, unknown> }[]
): Promise<{ steps: CollectionStepResult[] }> {
  const res = await apiFetch(`${BASE}/run-collection`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ steps }),
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
    if (prop.default !== undefined) { stub[k] = prop.default; continue; }
    const rawType = prop.type;
    const type = Array.isArray(rawType)
      ? (rawType.find((t) => t !== "null") ?? "string")
      : (rawType ?? "string");
    if (prop.enum && prop.enum.length > 0) { stub[k] = prop.enum[0]; continue; }
    if (type === "number" || type === "integer") stub[k] = required.includes(k) ? 1 : 0;
    else if (type === "boolean") stub[k] = false;
    else if (type === "array") stub[k] = [];
    else if (type === "object") stub[k] = {};
    else stub[k] = "";
  }

  return JSON.stringify(stub, null, 2);
}

// LocalStorage helpers for collections
const COLLECTIONS_KEY = "mcp-man:collections";

export function loadCollections(): Collection[] {
  try {
    const raw = localStorage.getItem(COLLECTIONS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

export function saveCollections(collections: Collection[]): void {
  localStorage.setItem(COLLECTIONS_KEY, JSON.stringify(collections));
}

export function createCollection(name: string, steps: CollectionStep[] = []): Collection {
  return { id: crypto.randomUUID(), name, steps, createdAt: Date.now() };
}
