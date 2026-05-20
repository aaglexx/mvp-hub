# mcp-man

> Postman for MCP — search, inspect and test Model Context Protocol servers from your browser.

```bash
npm install -g @aaglexx/mcp-man
mcp-man ui
```

Opens at **http://localhost:4242**

---

## What is this?

MCP servers are multiplying fast — there are hundreds of them. But figuring out what a server actually does means digging through GitHub READMEs and guessing at parameters.

`mcp-man` connects to any MCP server, lists all its tools with full schemas, and lets you call them with custom arguments — right in the browser.

Think of it like `man` pages, but for MCP.

---

## Features

- **Registry** — searchable catalog of 30+ real MCP servers
- **Inspect** — connect to any server and see all tools, resources and prompts
- **Test** — call any tool with JSON arguments and see the live response
- **CLI** — all features available from the terminal too

---

## Usage

### Web UI (recommended)

```bash
mcp-man ui
```

Starts the API server and opens the browser automatically.

### CLI

```bash
# Search the registry
mcp-man search github
mcp-man search --tag database

# Inspect a server
mcp-man inspect "npx -y @modelcontextprotocol/server-filesystem C:\path\to\dir"

# Call a tool
mcp-man test list_directory --server "npx -y @modelcontextprotocol/server-filesystem C:\path"
```

---

## Examples

**Explore the filesystem server:**
```
Server: npx -y @modelcontextprotocol/server-filesystem C:\Users\you\Documents
```

**Explore the memory server (no config needed):**
```
Server: npx -y @modelcontextprotocol/server-memory
```

**Explore the GitHub server (needs token):**
```
Server: GITHUB_PERSONAL_ACCESS_TOKEN=your_token npx -y @modelcontextprotocol/server-github
```

---

## Registry

The registry lives in [`registry/servers.json`](./registry/servers.json). Currently includes:

| Server | Tags |
|--------|------|
| `@modelcontextprotocol/server-filesystem` | filesystem, official |
| `@modelcontextprotocol/server-github` | git, github, official |
| `@modelcontextprotocol/server-postgres` | database, sql, official |
| `@modelcontextprotocol/server-memory` | memory, official |
| `@modelcontextprotocol/server-slack` | messaging, official |
| `@playwright/mcp` | browser, automation |
| `@notionhq/notion-mcp-server` | notion, productivity |
| `@upstash/context7-mcp` | docs, developer |
| and 22 more... | |

### Add your server

Open a PR editing `registry/servers.json`:

```json
{
  "name": "@your-scope/your-mcp-server",
  "description": "One sentence about what this server does",
  "url": "https://github.com/you/your-server",
  "tags": ["your", "tags"],
  "author": "Your Name",
  "license": "MIT"
}
```

---

## How it works

```
mcp-man ui
    │
    ├── API server (localhost:7070)
    │       ├── GET  /api/search   — registry lookup
    │       ├── POST /api/inspect  — connects to MCP server, lists tools
    │       └── POST /api/test     — connects to MCP server, calls a tool
    │
    └── Web UI (localhost:4242)
            └── React + Vite, served as static files
```

The API server spawns MCP servers as child processes on demand using the official `@modelcontextprotocol/sdk`, runs the requested operation, and closes the connection.

---

## Development

```bash
git clone https://github.com/aaglexx/mvp-hub
cd mvp-hub
npm install

# Terminal 1 — API server
npm run dev:cli -- ui --dev

# Terminal 2 — Vite dev server with HMR
npm run dev:web
```

Open http://localhost:4242

### Build

```bash
npm run build
```

Compiles TypeScript CLI to `dist/` and builds React UI to `web/dist/`.

---

## Roadmap

- [x] CLI: search, inspect, test, add
- [x] Web UI: registry browser, inspector, tool tester
- [ ] Sandboxed runner (Docker/WASM) — no local install needed
- [ ] Schema visualizer — interactive view of tool input/output types
- [ ] Auth helper — guided setup for servers that need API keys
- [ ] `mcp-man badge` — CI badge showing server health status

---

## License

MIT — see [LICENSE](./LICENSE)
