import { Command } from "commander";
import chalk from "chalk";
import { startApiServer } from "../core/server.js";
import { createReadStream, existsSync } from "fs";
import { createServer } from "http";
import { join, extname, dirname } from "path";
import { fileURLToPath } from "url";
import { createRequire } from "module";

const MIME: Record<string, string> = {
  ".html": "text/html",
  ".js":   "application/javascript",
  ".css":  "text/css",
  ".svg":  "image/svg+xml",
  ".ico":  "image/x-icon",
  ".png":  "image/png",
  ".woff2": "font/woff2",
};

function findWebDist(): string {
  // Strategy 1: relative to this file (works in dev + local install)
  try {
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = dirname(__filename);
    const candidate = join(__dirname, "../../web/dist");
    if (existsSync(join(candidate, "index.html"))) return candidate;
  } catch { /* ignore */ }

  // Strategy 2: relative to the package root via require.resolve
  try {
    const require = createRequire(import.meta.url);
    const pkgPath = require.resolve("@aaglexx/mcp-man/package.json");
    const candidate = join(dirname(pkgPath), "web/dist");
    if (existsSync(join(candidate, "index.html"))) return candidate;
  } catch { /* ignore */ }

  // Strategy 3: walk up from __dirname looking for web/dist
  try {
    const __filename = fileURLToPath(import.meta.url);
    let dir = dirname(__filename);
    for (let i = 0; i < 6; i++) {
      const candidate = join(dir, "web/dist");
      if (existsSync(join(candidate, "index.html"))) return candidate;
      dir = dirname(dir);
    }
  } catch { /* ignore */ }

  return "";
}

export const uiCommand = new Command("ui")
  .description("Start the web UI (opens at http://localhost:4242)")
  .option("--dev", "dev mode — just start API, Vite handles the UI")
  .action(async (opts) => {
    console.log(chalk.bold("\n  mcp-man\n"));

    startApiServer();

    if (opts.dev) {
      console.log(chalk.gray("  API running on http://localhost:7070"));
      console.log(chalk.gray("  Run `npm run dev:web` for the UI\n"));
    } else {
      const webDist = findWebDist();

      if (!webDist) {
        console.log(chalk.yellow("  Web UI not found. Try reinstalling: npm install -g @aaglexx/mcp-man\n"));
      } else {
        const staticServer = createServer((req, res) => {
          let filePath = join(webDist, req.url === "/" ? "/index.html" : req.url!);
          if (!existsSync(filePath)) filePath = join(webDist, "index.html");
          const ext = extname(filePath);
          const mime = MIME[ext] ?? "application/octet-stream";
          res.writeHead(200, {
            "Content-Type": mime,
            "Cache-Control": ext === ".html" ? "no-cache" : "max-age=31536000",
          });
          createReadStream(filePath).pipe(res);
        });

        staticServer.on("error", (e) => {
          console.error(chalk.red(`  Static server error: ${e.message}`));
        });

        staticServer.listen(4242, () => {
          console.log(chalk.cyan("  Web UI  →  http://localhost:4242"));
        });
      }
    }

    // Open browser
    setTimeout(async () => {
      try {
        const { execSync } = await import("child_process");
        const url = "http://localhost:4242";
        const cmd = process.platform === "win32"
          ? `start "" "${url}"`
          : process.platform === "darwin"
          ? `open "${url}"`
          : `xdg-open "${url}"`;
        execSync(cmd, { stdio: "ignore" });
      } catch { /* ignore */ }
    }, 1000);

    console.log(chalk.gray("  Press Ctrl+C to stop\n"));
    process.on("SIGINT", () => { console.log(""); process.exit(0); });
  });
