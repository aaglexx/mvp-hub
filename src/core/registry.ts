import { z } from "zod";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { homedir } from "os";
import { join } from "path";
import { fileURLToPath } from "url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));

const REGISTRY_URL =
  "https://raw.githubusercontent.com/aaglexx/mvp-hub/main/registry/servers.json";

const CACHE_DIR = join(homedir(), ".mcp-man");
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
    try {
      const cached = JSON.parse(readFileSync(CACHE_FILE).toString());
      const age = Date.now() - new Date(cached.updatedAt).getTime();
      if (age < CACHE_TTL_MS) {
        return RegistrySchema.parse(cached);
      }
    } catch {
      // cache corrupt, continue
    }
  }

  // Fetch from GitHub
  const res = await fetch(REGISTRY_URL).catch(() => null);
  if (res && res.ok) {
    try {
      const data = await res.json();
      const registry = RegistrySchema.parse(data);
      mkdirSync(CACHE_DIR, { recursive: true });
      writeFileSync(CACHE_FILE, JSON.stringify(registry, null, 2));
      return registry;
    } catch {
      // parse error, fall through to bundled
    }
  }

  // Fall back to bundled registry (ships with npm package)
  return getBundledRegistry();
}

function getBundledRegistry(): Registry {
  // Try to read the bundled registry/servers.json
  const candidates = [
    join(__dirname, "../../registry/servers.json"),
    join(__dirname, "../../../registry/servers.json"),
    join(process.cwd(), "registry/servers.json"),
  ];

  for (const p of candidates) {
    if (existsSync(p)) {
      try {
        const data = JSON.parse(readFileSync(p).toString());
        return RegistrySchema.parse(data);
      } catch {
        continue;
      }
    }
  }

  // Absolute fallback — hardcoded minimal list
  return {
    updatedAt: new Date().toISOString(),
    servers: [
      {
        name: "@modelcontextprotocol/server-filesystem",
        description: "Secure file operations — read, write, search, move files",
        url: "https://github.com/modelcontextprotocol/servers",
        tags: ["filesystem", "official"],
        author: "Anthropic",
        license: "MIT",
      },
      {
        name: "@modelcontextprotocol/server-github",
        description: "Interact with GitHub repos, issues, PRs, code search",
        url: "https://github.com/modelcontextprotocol/servers",
        tags: ["git", "github", "official"],
        author: "Anthropic",
        license: "MIT",
      },
    ],
  };
}
