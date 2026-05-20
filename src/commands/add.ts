import { Command } from "commander";
import chalk from "chalk";

export const addCommand = new Command("add")
  .description("Submit a new MCP server to the registry")
  .argument("<url>", "npm package name or git URL of the MCP server")
  .action(async (url: string) => {
    // In MVP: open a GitHub issue pre-filled with server info
    // Later: auto-inspect + open PR to registry.json
    const title = encodeURIComponent(`Add server: ${url}`);
    const body = encodeURIComponent(
      `**Server URL/package:** ${url}\n\n**Description:**\n\n**Tags:**\n\n**Author:**`
    );
    const issueUrl = `https://github.com/your-org/mcp-hub/issues/new?title=${title}&body=${body}&labels=new-server`;

    console.log(chalk.bold("\nTo add your server to the registry:\n"));
    console.log(chalk.gray("  1. Open the pre-filled GitHub issue:"));
    console.log(chalk.cyan(`\n  ${issueUrl}\n`));
    console.log(
      chalk.gray(
        "  2. Fill in description and tags\n  3. A maintainer will review and merge it into registry.json\n"
      )
    );
  });
