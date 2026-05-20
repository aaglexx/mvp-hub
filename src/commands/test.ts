import { Command } from "commander";
import chalk from "chalk";
import ora from "ora";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

export const testCommand = new Command("test")
  .description("Call a specific tool on an MCP server with test arguments")
  .argument("<tool>", "tool name to call")
  .argument("[argsJson]", "tool arguments as JSON string", "{}")
  .option("-s, --server <cmd>", "command to start the MCP server")
  .action(async (toolName: string, argsStr: string, opts) => {
    const raw = process.env.MCP_ARGS ?? argsStr ?? "{}";
    let args: Record<string, unknown>;
    try {
      args = JSON.parse(raw);
    } catch {
      console.error(chalk.red("args must be valid JSON, got: " + raw));
      process.exit(1);
    }

    const serverCmd = opts.server;
    if (!serverCmd) {
      console.error(chalk.red("Use --server <cmd> to specify the MCP server command"));
      process.exit(1);
    }

    const spinner = ora("Connecting...").start();
    const parts = serverCmd.split(" ");
    const cmd = parts[0];
    const cmdArgs = parts.slice(1);

    const transport = new StdioClientTransport({ command: cmd, args: cmdArgs });
    const client = new Client({ name: "mcp-hub", version: "0.1.0" }, {});

    try {
      await client.connect(transport);
      spinner.text = `Calling ${toolName}...`;

      const result = await client.callTool({ name: toolName, arguments: args });
      spinner.succeed(`Tool "${toolName}" responded`);

      console.log(chalk.bold("\nResult:\n"));
      const content = result.content as Array<{ type: string; text?: string }>;
      for (const block of content) {
        if (block.type === "text") {
          console.log(block.text);
        } else {
          console.log(chalk.gray(JSON.stringify(block, null, 2)));
        }
      }
    } catch (err) {
      spinner.fail("Failed");
      console.error(chalk.red(String(err)));
      process.exit(1);
    } finally {
      await client.close();
    }
  });
