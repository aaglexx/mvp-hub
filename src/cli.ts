#!/usr/bin/env node
import { Command } from "commander";
import { searchCommand } from "./commands/search.js";
import { inspectCommand } from "./commands/inspect.js";
import { addCommand } from "./commands/add.js";
import { testCommand } from "./commands/test.js";
import { uiCommand } from "./commands/ui.js";

const program = new Command();

program
  .name("mcp-man")
  .description("Registry and inspector for MCP servers")
  .version("0.1.0");

program.addCommand(searchCommand);
program.addCommand(inspectCommand);
program.addCommand(addCommand);
program.addCommand(testCommand);
program.addCommand(uiCommand);

program.parse();