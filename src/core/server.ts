import { createServer } from "http";
import { loadRegistry } from "../core/registry.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const PORT = 7070;

async function connectAndRun<T>(
  command: string,
  fn: (client: Client) => Promise<T>
): Promise<T> {
  const parts = command.split(" ");
  const transport = new StdioClientTransport({ command: parts[0], args: parts.slice(1) });
  const client = new Client({ name: "mcp-man", version: "0.1.0" }, {});
  await client.connect(transport);
  try {
    return await fn(client);
  } finally {
    await client.close();
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function json(res: any, data: unknown, status = 200) {
  res.writeHead(status, {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
  });
  res.end(JSON.stringify(data));
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

    // GET /api/search
    if (req.method === "GET" && url.pathname === "/api/search") {
      const q = url.searchParams.get("q") ?? undefined;
      const tag = url.searchParams.get("tag") ?? undefined;
      const registry = await loadRegistry();
      let results = registry.servers;
      if (q) results = results.filter((s) => s.name.includes(q) || s.description.toLowerCase().includes(q.toLowerCase()));
      if (tag) results = results.filter((s) => s.tags.includes(tag));
      return json(res, results);
    }

    // POST /api/inspect
    if (req.method === "POST" && url.pathname === "/api/inspect") {
      let body = "";
      req.on("data", (c) => (body += c));
      await new Promise((r) => req.on("end", r));
      const { command } = JSON.parse(body);
      try {
        const result = await connectAndRun(command, async (client) => {
          const [t, r, p] = await Promise.all([
            client.listTools().catch(() => ({ tools: [] })),
            client.listResources().catch(() => ({ resources: [] })),
            client.listPrompts().catch(() => ({ prompts: [] })),
          ]);
          return { tools: t.tools, resources: r.resources, prompts: p.prompts };
        });
        return json(res, result);
      } catch (e) {
        return json(res, { error: String(e) }, 500);
      }
    }

    // POST /api/test
    if (req.method === "POST" && url.pathname === "/api/test") {
      let body = "";
      req.on("data", (c) => (body += c));
      await new Promise((r) => req.on("end", r));
      const { command, tool, args } = JSON.parse(body);
      try {
        const result = await connectAndRun(command, async (client) => {
          return client.callTool({ name: tool, arguments: args });
        });
        return json(res, result);
      } catch (e) {
        return json(res, { error: String(e) }, 500);
      }
    }

    json(res, { error: "not found" }, 404);
  });

  server.listen(PORT, () => {
    console.log(`\n  mcp-man API  →  http://localhost:${PORT}`);
    console.log(`  Web UI       →  http://localhost:4242\n`);
  });
}
