import { Command } from "commander";
import chalk from "chalk";
import { loadRegistry } from "../core/registry.js";

export const searchCommand = new Command("search")
  .description("Search MCP servers in the registry")
  .argument("[query]", "search query")
  .option("-t, --tag <tag>", "filter by tag (e.g. filesystem, git, database)")
  .option("--json", "output as JSON")
  .action(async (query: string | undefined, opts) => {
    const registry = await loadRegistry();

    let results = registry.servers;

    if (query) {
      const q = query.toLowerCase();
      results = results.filter(
        (s) =>
          s.name.toLowerCase().includes(q) ||
          s.description.toLowerCase().includes(q)
      );
    }

    if (opts.tag) {
      results = results.filter((s) => s.tags.includes(opts.tag));
    }

    if (opts.json) {
      console.log(JSON.stringify(results, null, 2));
      return;
    }

    if (results.length === 0) {
      console.log(chalk.yellow("No servers found."));
      return;
    }

    console.log(chalk.bold(`\n${results.length} server(s) found:\n`));

    for (const server of results) {
      console.log(
        chalk.cyan(`  ${server.name}`) +
          chalk.gray(` — ${server.description}`)
      );
      console.log(
        chalk.gray(`    tags: `) +
          server.tags.map((t) => chalk.blue(t)).join(", ")
      );
      console.log(chalk.gray(`    url:  ${server.url}\n`));
    }
  });
