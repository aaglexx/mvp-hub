import { z } from "zod";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { homedir } from "os";
import { join } from "path";

const REGISTRY_URL =
  "https://raw.githubusercontent.com/aaglexx/mvp-hub/main/registry/servers.json";

const CACHE_DIR = join(homedir(), ".mcp-hub");
const CACHE_FILE = join(CACHE_DIR, "registry.json");
const CACHE_TTL_MS = 1000 * 60 * 60; // 1 hour

const ServerSchema = z.object({
  name: z.string(),
  description: z.string(),
  url: z.string(),
  tags: z.array(z.string()),
  author: z.string().optional(),
  license: z.string().optional(),
});

const RegistrySchema = z.object({
  updatedAt: z.string(),
  servers: z.array(ServerSchema),
});

export type MCPServer = z.infer<typeof ServerSchema>;
export type Registry = z.infer<typeof RegistrySchema>;

export async function loadRegistry(): Promise<Registry> {
  // Use local cache if fresh
  if (existsSync(CACHE_FILE)) {
    const stat = readFileSync(CACHE_FILE);
    const cached = JSON.parse(stat.toString());
    const age = Date.now() - new Date(cached.updatedAt).getTime();
    if (age < CACHE_TTL_MS) {
      return RegistrySchema.parse(cached);
    }
  }

  // Fetch from GitHub
  const res = await fetch(REGISTRY_URL).catch(() => null);
  if (!res || !res.ok) {
    // Fall back to bundled registry
    return getBundledRegistry();
  }

  const data = await res.json();
  const registry = RegistrySchema.parse(data);

  mkdirSync(CACHE_DIR, { recursive: true });
  writeFileSync(CACHE_FILE, JSON.stringify(registry, null, 2));

  return registry;
}

function getBundledRegistry(): Registry {
  return {
    updatedAt: new Date().toISOString(),
    servers: [
      {
        name: "@modelcontextprotocol/server-filesystem",
        description: "Read and write local files and directories",
        url: "https://github.com/modelcontextprotocol/servers",
        tags: ["filesystem", "official"],
        author: "Anthropic",
        license: "MIT",
      },
      {
        name: "@modelcontextprotocol/server-github",
        description: "Interact with GitHub repos, issues and PRs",
        url: "https://github.com/modelcontextprotocol/servers",
        tags: ["git", "github", "official"],
        author: "Anthropic",
        license: "MIT",
      },
      {
        name: "@modelcontextprotocol/server-postgres",
        description: "Query and inspect PostgreSQL databases",
        url: "https://github.com/modelcontextprotocol/servers",
        tags: ["database", "postgres", "official"],
        author: "Anthropic",
        license: "MIT",
      },
    ],
  };
}
