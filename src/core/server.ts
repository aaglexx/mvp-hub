import { createServer, IncomingMessage, ServerResponse } from "http";
import { loadRegistry } from "../core/registry.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const PORT = 7070;
const CONNECT_TIMEOUT_MS = 60000;
const CALL_TIMEOUT_MS = 30000;

function parseCommand(command: string): { cmd: string; args: string[] } {
  // Simple shell-like split respecting quoted strings
  const parts: string[] = [];
  let current = "";
  let inQuote = false;
  let quoteChar = "";

  for (const ch of command) {
    if (inQuote) {
      if (ch === quoteChar) { inQuote = false; }
      else { current += ch; }
    } else if (ch === '"' || ch === "'") {
      inQuote = true;
      quoteChar = ch;
    } else if (ch === " " && current) {
      parts.push(current);
      current = "";
    } else if (ch !== " ") {
      current += ch;
    }
  }
  if (current) parts.push(current);

  return { cmd: parts[0] ?? "", args: parts.slice(1) };
}

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Timeout: ${label} took longer than ${ms}ms`)), ms);
    promise.then((v) => { clearTimeout(timer); resolve(v); })
           .catch((e) => { clearTimeout(timer); reject(e); });
  });
}

async function connectAndRun<T>(
  command: string,
  fn: (client: Client) => Promise<T>
): Promise<T> {
  const { cmd, args } = parseCommand(command);
  if (!cmd) throw new Error("Empty command");

  const transport = new StdioClientTransport({ command: cmd, args });
  const client = new Client({ name: "mcp-man", version: "0.1.0" }, {});

  await withTimeout(client.connect(transport), CONNECT_TIMEOUT_MS, "connect");
  try {
    return await withTimeout(fn(client), CALL_TIMEOUT_MS, "call");
  } finally {
    await client.close().catch(() => {});
  }
}

function json(res: ServerResponse<IncomingMessage>, data: unknown, status = 200) {
  res.writeHead(status, {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
  });
  res.end(JSON.stringify(data));
}

async function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve) => {
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", () => resolve(body));
  });
}

export function startApiServer() {
  const server = createServer(async (req, res) => {
    // CORS preflight
    if (req.method === "OPTIONS") {
      res.writeHead(204, {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
      });
      res.end();
      return;
    }

    const url = new URL(req.url ?? "/", `http://localhost:${PORT}`);

    try {
      // GET /api/search
      if (req.method === "GET" && url.pathname === "/api/search") {
        const q = url.searchParams.get("q") ?? undefined;
        const tag = url.searchParams.get("tag") ?? undefined;
        const registry = await loadRegistry();
        let results = registry.servers;
        if (q) {
          const lq = q.toLowerCase();
          results = results.filter(
            (s) => s.name.toLowerCase().includes(lq) || s.description.toLowerCase().includes(lq)
          );
        }
        if (tag) results = results.filter((s) => s.tags.includes(tag));
        return json(res, results);
      }

      // POST /api/inspect
      if (req.method === "POST" && url.pathname === "/api/inspect") {
        const body = await readBody(req);
        const { command } = JSON.parse(body);
        if (!command) return json(res, { error: "command is required" }, 400);

        const result = await connectAndRun(command, async (client) => {
          const [t, r, p] = await Promise.allSettled([
            client.listTools(),
            client.listResources(),
            client.listPrompts(),
          ]);
          return {
            tools: t.status === "fulfilled" ? t.value.tools : [],
            resources: r.status === "fulfilled" ? r.value.resources : [],
            prompts: p.status === "fulfilled" ? p.value.prompts : [],
          };
        });
        return json(res, result);
      }

      // POST /api/test
      if (req.method === "POST" && url.pathname === "/api/test") {
        const body = await readBody(req);
        const { command, tool, args } = JSON.parse(body);
        if (!command) return json(res, { error: "command is required" }, 400);
        if (!tool) return json(res, { error: "tool is required" }, 400);

        const result = await connectAndRun(command, async (client) => {
          return client.callTool({ name: tool, arguments: args ?? {} });
        });
        return json(res, result);
      }

      json(res, { error: "not found" }, 404);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      json(res, { error: msg }, 500);
    }
  });

  server.listen(PORT, () => {
    console.log(`\n  mcp-man API  →  http://localhost:${PORT}`);
    console.log(`  Web UI       →  http://localhost:4242\n`);
  });
}
