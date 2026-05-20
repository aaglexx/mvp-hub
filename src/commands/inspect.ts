import { Command } from "commander";
import chalk from "chalk";
import ora from "ora";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

export const inspectCommand = new Command("inspect")
  .description("Inspect an MCP server — list its tools, resources and prompts")
  .argument("<command>", "command to start the MCP server (e.g. 'npx @scope/mcp-server')")
  .option("--json", "output as JSON")
  .action(async (command: string, opts) => {
    const spinner = ora(`Connecting to server...`).start();

    const [cmd, ...args] = command.split(" ");
    const transport = new StdioClientTransport({ command: cmd, args });
    const client = new Client({ name: "mcp-hub", version: "0.1.0" }, {});

    try {
      await client.connect(transport);
      spinner.succeed("Connected");

      const [toolsRes, resourcesRes, promptsRes] = await Promise.all([
        client.listTools().catch(() => ({ tools: [] })),
        client.listResources().catch(() => ({ resources: [] })),
        client.listPrompts().catch(() => ({ prompts: [] })),
      ]);

      if (opts.json) {
        console.log(
          JSON.stringify(
            {
              tools: toolsRes.tools,
              resources: resourcesRes.resources,
              prompts: promptsRes.prompts,
            },
            null,
            2
          )
        );
        await client.close();
        return;
      }

      // Tools
      console.log(chalk.bold(`\n🔧 Tools (${toolsRes.tools.length})\n`));
      for (const tool of toolsRes.tools) {
        console.log(`  ${chalk.cyan(tool.name)}`);
        console.log(chalk.gray(`    ${tool.description ?? "—"}`));
        const params = Object.keys(
          tool.inputSchema?.properties ?? {}
        ).join(", ");
        if (params) console.log(chalk.gray(`    params: ${params}`));
        console.log();
      }

      // Resources
      if (resourcesRes.resources.length > 0) {
        console.log(chalk.bold(`📦 Resources (${resourcesRes.resources.length})\n`));
        for (const r of resourcesRes.resources) {
          console.log(`  ${chalk.cyan(r.name)} ${chalk.gray(r.uri)}`);
        }
        console.log();
      }

      // Prompts
      if (promptsRes.prompts.length > 0) {
        console.log(chalk.bold(`💬 Prompts (${promptsRes.prompts.length})\n`));
        for (const p of promptsRes.prompts) {
          console.log(`  ${chalk.cyan(p.name)} — ${chalk.gray(p.description ?? "—")}`);
        }
        console.log();
      }
    } catch (err) {
      spinner.fail("Connection failed");
      console.error(chalk.red(String(err)));
      process.exit(1);
    } finally {
      await client.close();
    }
  });
