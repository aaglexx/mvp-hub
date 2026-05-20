import { Command } from "commander";
import chalk from "chalk";
import { startApiServer } from "../core/server.js";
import { createReadStream, existsSync } from "fs";
import { createServer } from "http";
import { join, extname } from "path";
import { fileURLToPath } from "url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));

const MIME: Record<string, string> = {
  ".html": "text/html",
  ".js": "application/javascript",
  ".css": "text/css",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
};

export const uiCommand = new Command("ui")
  .description("Start the web UI (opens at http://localhost:4242)")
  .option("--dev", "dev mode — just start API, Vite handles UI")
  .action(async (opts) => {
    console.log(chalk.bold("\n  mcp-man\n"));

    // Always start API server on 7070
    startApiServer();

    if (opts.dev) {
      console.log(chalk.gray("  API running on http://localhost:7070"));
      console.log(chalk.gray("  Run `npm run dev:web` for the UI\n"));
    } else {
      // Serve web/dist as static files on 4242
      const webDist = join(__dirname, "../../web/dist");

      if (!existsSync(webDist)) {
        console.log(chalk.yellow("  Web UI not built. Run `npm run build:web` first.\n"));
      } else {
        const staticServer = createServer((req, res) => {
          let filePath = join(webDist, req.url === "/" ? "/index.html" : req.url!);
          if (!existsSync(filePath)) filePath = join(webDist, "index.html");
          const ext = extname(filePath);
          res.writeHead(200, { "Content-Type": MIME[ext] ?? "text/plain" });
          createReadStream(filePath).pipe(res);
        });
        staticServer.listen(4242, () => {
          console.log(chalk.cyan("  Web UI  →  http://localhost:4242"));
        });
      }
    }

    // Open browser
    const { execSync } = await import("child_process");
    setTimeout(() => {
      try {
        const url = "http://localhost:4242";
        const cmd = process.platform === "win32" ? `start ${url}`
          : process.platform === "darwin" ? `open ${url}`
          : `xdg-open ${url}`;
        execSync(cmd);
      } catch { /* ignore */ }
    }, 800);

    console.log(chalk.gray("  Press Ctrl+C to stop\n"));
    process.on("SIGINT", () => process.exit(0));
  });
