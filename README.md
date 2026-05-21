[![npm version](https://img.shields.io/npm/v/@aaglexx/mcp-man)](https://www.npmjs.com/package/@aaglexx/mcp-man)
[![npm downloads](https://img.shields.io/npm/dm/@aaglexx/mcp-man)](https://www.npmjs.com/package/@aaglexx/mcp-man)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](./LICENSE)

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

`mcp-man` connects to any MCP server, lists all its tools with full schemas, and lets you call them with custom arguments — right in the browser. Like `man` pages, but for MCP.

---

## Features

- **Registry** — searchable catalog of 156 real MCP servers
- **Inspect** — connect to any server, see all tools with full schema visualizer
- **Test** — call any tool with JSON arguments and see the live response
- **Auth helper** — guided setup for servers that need API keys
- **CLI** — all features available from the terminal too

---

## Usage

### Web UI (recommended)

```bash
npm install -g @aaglexx/mcp-man
mcp-man ui
```

Starts the API server on `:7070` and opens the browser at `http://localhost:4242`.

### CLI

```bash
# Search the registry
mcp-man search github
mcp-man search --tag database

# Inspect a server — list all tools, resources and prompts
mcp-man inspect "npx -y @modelcontextprotocol/server-filesystem C:\path\to\dir"

# Call a tool with arguments
mcp-man test list_directory --server "npx -y @modelcontextprotocol/server-filesystem C:\path"
```

---

## Servers that need no setup

These work out of the box — just paste the command and hit inspect:

```
npx -y @modelcontextprotocol/server-memory
npx -y @modelcontextprotocol/server-filesystem C:\Users\you\Documents
npx -y mcp-server-time
npx -y @modelcontextprotocol/server-everything
```

## Servers that need API keys

Click any server in the Registry — if it needs credentials, an auth wizard will guide you through it step by step with links to get each token.

Examples:
- `github-mcp-server` → needs `GITHUB_PERSONAL_ACCESS_TOKEN`
- `@notionhq/notion-mcp-server` → needs Notion integration token
- `@modelcontextprotocol/server-brave-search` → needs `BRAVE_API_KEY`

---

## Registry

156 servers across categories:

| Category | Examples |
|----------|---------|
| **Official** | filesystem, git, github, memory, postgres, redis, slack |
| **Databases** | MySQL, MongoDB, ClickHouse, Neo4j, Snowflake, Elasticsearch |
| **Cloud** | AWS, GCP, Azure, Cloudflare, Vercel, Supabase, Firebase |
| **Productivity** | Notion, Google Drive, Gmail, Calendar, Slack, Discord |
| **AI/LLM** | OpenAI, Anthropic, Ollama, Replicate, LangChain, Pinecone |
| **Dev tools** | Docker, Kubernetes, Sentry, Datadog, GitHub Actions, CircleCI |
| **Search** | Brave, Tavily, Exa, Perplexity, Wikipedia, arXiv |
| **Finance** | Stripe, Coinbase, Plaid, Alpha Vantage |

### Add your server

Open a PR editing [`registry/servers.json`](./registry/servers.json):

```json
{
  "name": "@your-scope/your-mcp-server",
  "description": "One sentence about what this server does",
  "url": "https://github.com/you/your-server",
  "tags": ["your", "tags"],
  "author": "Your Name",
  "license": "MIT",
  "env": [
    {
      "name": "YOUR_API_KEY",
      "description": "API key from your-service.com/settings",
      "required": true,
      "url": "https://your-service.com/settings/api-keys"
    }
  ]
}
```

---

## How it works

```
mcp-man ui
    │
    ├── API server (localhost:7070)
    │       ├── GET  /api/search   — registry lookup
    │       ├── POST /api/inspect  — spawns MCP server process, lists tools
    │       └── POST /api/test     — spawns MCP server process, calls a tool
    │
    └── Web UI (localhost:4242)
            └── React app served as static files
```

MCP servers are spawned as child processes on demand using the official `@modelcontextprotocol/sdk`. The connection is opened, the operation is performed, and the process is closed — no persistent connections.

---

## Development

```bash
git clone https://github.com/aaglexx/mcp-man
cd mcp-man
npm install

# Terminal 1 — API server
npm run dev:cli -- ui --dev

# Terminal 2 — Vite dev server with HMR
npm run dev:web
```

Open http://localhost:4242

```bash
# Build for production
npm run build

# Publish to npm
npm version patch
npm publish --access public
```

---

## Roadmap

- [x] CLI: search, inspect, test, add
- [x] Web UI: registry browser, inspector, tool tester
- [x] Auth wizard — guided API key setup for 78 servers
- [x] Schema visualizer — types, required/optional, nested objects
- [x] 156 real MCP servers in registry
- [ ] Sandboxed runner — test servers without local install (Docker/WASM)
- [ ] `mcp-man badge` — CI badge showing server health status

---

## License

MIT — see [LICENSE](./LICENSE)
