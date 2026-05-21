import { createServer, IncomingMessage, ServerResponse } from "http";
import { loadRegistry } from "../core/registry.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const PORT = 7070;
const CALL_TIMEOUT_MS = 60000;

interface ParsedCommand {
  cmd: string;
  args: string[];
  env: Record<string, string>;
}

function parseCommand(command: string): ParsedCommand {
  const tokens: string[] = [];
  let current = "";
  let inQuote = false;
  let quoteChar = "";

  for (const ch of command.trim()) {
    if (inQuote) {
      if (ch === quoteChar) { inQuote = false; }
      else { current += ch; }
    } else if (ch === '"' || ch === "'") {
      inQuote = true; quoteChar = ch;
    } else if (ch === " ") {
      if (current) { tokens.push(current); current = ""; }
    } else { current += ch; }
  }
  if (current) tokens.push(current);

  const env: Record<string, string> = {};
  let cmdIndex = 0;
  for (let i = 0; i < tokens.length; i++) {
    const match = tokens[i].match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (match) { env[match[1]] = match[2]; cmdIndex = i + 1; }
    else { break; }
  }

  const remaining = tokens.slice(cmdIndex);
  return { cmd: remaining[0] ?? "", args: remaining.slice(1), env };
}

async function connectAndRun<T>(
  command: string,
  fn: (client: Client) => Promise<T>
): Promise<T> {
  const { cmd, args, env } = parseCommand(command);
  if (!cmd) throw new Error("Empty command");

  const transport = new StdioClientTransport({
    command: cmd, args,
    env: Object.keys(env).length > 0 ? env : undefined,
    stderr: "pipe",
  });

  const client = new Client({ name: "mcp-man", version: "0.1.0" }, {});
  const stderrChunks: Buffer[] = [];
  // @ts-ignore
  transport._stderrStream?.on("data", (d: Buffer) => stderrChunks.push(d));

  try {
    await client.connect(transport);
  } catch (e) {
    const stderr = stderrChunks.length
      ? "\n" + Buffer.concat(stderrChunks).toString().slice(0, 400)
      : "";
    const msg = e instanceof Error ? e.message : String(e);
    throw new Error(msg + stderr);
  }

  try {
    return await Promise.race([
      fn(client),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("Operation timed out after 60s")), CALL_TIMEOUT_MS)
      ),
    ]);
  } finally {
    await client.close().catch(() => {});
  }
}

function json(res: ServerResponse<IncomingMessage>, data: unknown, status = 200) {
  if (res.headersSent) return;
  res.writeHead(status, {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
  });
  res.end(JSON.stringify(data));
}

async function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", () => resolve(body));
    req.on("error", reject);
  });
}

export function startApiServer() {
  const server = createServer(async (req, res) => {
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

      // POST /api/inspect — single server
      if (req.method === "POST" && url.pathname === "/api/inspect") {
        const body = await readBody(req);
        let parsed: { command?: string };
        try { parsed = JSON.parse(body); } catch { return json(res, { error: "Invalid JSON body" }, 400); }
        if (!parsed.command?.trim()) return json(res, { error: "command is required" }, 400);

        const result = await connectAndRun(parsed.command, async (client) => {
          const [t, r, p] = await Promise.allSettled([
            client.listTools(), client.listResources(), client.listPrompts(),
          ]);
          return {
            tools: t.status === "fulfilled" ? t.value.tools : [],
            resources: r.status === "fulfilled" ? r.value.resources : [],
            prompts: p.status === "fulfilled" ? p.value.prompts : [],
          };
        });
        return json(res, result);
      }

      // POST /api/inspect-multi — inspect multiple servers in parallel
      if (req.method === "POST" && url.pathname === "/api/inspect-multi") {
        const body = await readBody(req);
        let parsed: { commands?: string[] };
        try { parsed = JSON.parse(body); } catch { return json(res, { error: "Invalid JSON body" }, 400); }
        if (!Array.isArray(parsed.commands) || parsed.commands.length === 0) {
          return json(res, { error: "commands array is required" }, 400);
        }

        const results = await Promise.allSettled(
          parsed.commands.map((command) =>
            connectAndRun(command, async (client) => {
              const [t, r, p] = await Promise.allSettled([
                client.listTools(), client.listResources(), client.listPrompts(),
              ]);
              return {
                command,
                tools: t.status === "fulfilled" ? t.value.tools : [],
                resources: r.status === "fulfilled" ? r.value.resources : [],
                prompts: p.status === "fulfilled" ? p.value.prompts : [],
              };
            })
          )
        );

        const out = results.map((r, i) =>
          r.status === "fulfilled"
            ? r.value
            : { command: parsed.commands![i], error: r.reason?.message ?? String(r.reason), tools: [], resources: [], prompts: [] }
        );
        return json(res, out);
      }

      // POST /api/test
      if (req.method === "POST" && url.pathname === "/api/test") {
        const body = await readBody(req);
        let parsed: { command?: string; tool?: string; args?: unknown };
        try { parsed = JSON.parse(body); } catch { return json(res, { error: "Invalid JSON body" }, 400); }
        if (!parsed.command?.trim()) return json(res, { error: "command is required" }, 400);
        if (!parsed.tool?.trim()) return json(res, { error: "tool is required" }, 400);

        const result = await connectAndRun(parsed.command, async (client) => {
          return client.callTool({
            name: parsed.tool!,
            arguments: (parsed.args as Record<string, unknown>) ?? {},
          });
        });
        return json(res, result);
      }

      // POST /api/run-collection — run a sequence of tool calls in order
      if (req.method === "POST" && url.pathname === "/api/run-collection") {
        const body = await readBody(req);
        let parsed: { steps?: { command: string; tool: string; args: Record<string, unknown> }[] };
        try { parsed = JSON.parse(body); } catch { return json(res, { error: "Invalid JSON body" }, 400); }
        if (!Array.isArray(parsed.steps) || parsed.steps.length === 0) {
          return json(res, { error: "steps array is required" }, 400);
        }

        const stepResults = [];
        for (const step of parsed.steps) {
          const startTime = Date.now();
          try {
            const result = await connectAndRun(step.command, async (client) => {
              return client.callTool({ name: step.tool, arguments: step.args ?? {} });
            });
            stepResults.push({
              command: step.command, tool: step.tool, args: step.args,
              result, durationMs: Date.now() - startTime, error: null,
            });
          } catch (e) {
            stepResults.push({
              command: step.command, tool: step.tool, args: step.args,
              result: null, durationMs: Date.now() - startTime,
              error: e instanceof Error ? e.message : String(e),
            });
          }
        }
        return json(res, { steps: stepResults });
      }

      json(res, { error: "not found" }, 404);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error("API error:", msg);
      json(res, { error: msg }, 500);
    }
  });

  server.on("error", (e) => { console.error("API server error:", e.message); });

  server.listen(PORT, () => {
    console.log(`\n  mcp-man API  →  http://localhost:${PORT}`);
    console.log(`  Web UI       →  http://localhost:4242\n`);
  });
}
