import { Command } from "commander";
import chalk from "chalk";
import ora from "ora";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

export const inspectCommand = new Command("inspect")
  .description("Inspect an MCP server — list its tools, resources and prompts")
  .argument("<command>", "command to start the MCP server (e.g. 'npx -y @scope/mcp-server')")
  .option("--json", "output as JSON")
  .action(async (command: string, opts) => {
    const spinner = ora("Connecting to server...").start();

    const parts = command.match(/(?:[^\s"']+|"[^"]*"|'[^']*')+/g) ?? [];
    const [cmd, ...args] = parts.map((p) => p.replace(/^["']|["']$/g, ""));

    const transport = new StdioClientTransport({ command: cmd, args });
    const client = new Client({ name: "mcp-man", version: "0.1.0" }, {});

    try {
      await client.connect(transport);
      spinner.succeed("Connected");

      const [toolsRes, resourcesRes, promptsRes] = await Promise.allSettled([
        client.listTools(),
        client.listResources(),
        client.listPrompts(),
      ]);

      const tools = toolsRes.status === "fulfilled" ? toolsRes.value.tools : [];
      const resources = resourcesRes.status === "fulfilled" ? resourcesRes.value.resources : [];
      const prompts = promptsRes.status === "fulfilled" ? promptsRes.value.prompts : [];

      if (opts.json) {
        console.log(JSON.stringify({ tools, resources, prompts }, null, 2));
        return;
      }

      console.log(chalk.bold(`\n🔧 Tools (${tools.length})\n`));
      for (const tool of tools) {
        console.log(`  ${chalk.cyan(tool.name)}`);
        console.log(chalk.gray(`    ${tool.description ?? "—"}`));
        const params = Object.keys(tool.inputSchema?.properties ?? {}).join(", ");
        if (params) console.log(chalk.gray(`    params: ${params}`));
        console.log();
      }

      if (resources.length > 0) {
        console.log(chalk.bold(`📦 Resources (${resources.length})\n`));
        for (const r of resources) {
          console.log(`  ${chalk.cyan(r.name)} ${chalk.gray(r.uri)}`);
        }
        console.log();
      }

      if (prompts.length > 0) {
        console.log(chalk.bold(`💬 Prompts (${prompts.length})\n`));
        for (const p of prompts) {
          console.log(`  ${chalk.cyan(p.name)} — ${chalk.gray(p.description ?? "—")}`);
        }
        console.log();
      }
    } catch (err) {
      spinner.fail("Connection failed");
      console.error(chalk.red(String(err)));
      process.exit(1);
    } finally {
      await client.close().catch(() => {});
    }
  });
