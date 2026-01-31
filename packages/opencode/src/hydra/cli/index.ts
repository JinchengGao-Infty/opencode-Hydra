import type { Argv } from "yargs"
import { AgentCommands } from "./agent"
import { StatusCommand } from "./status"
import { TaskCommands } from "./task"

export namespace HydraCLI {
  export function register(yargs: Argv) {
    return yargs
      .command("task", "Manage tasks", TaskCommands.register)
      .command("agent", "Manage agents", AgentCommands.register)
      .command("status", "Show overall status", (yargs: Argv) => yargs, StatusCommand.handler)
      .demandCommand(1, "Please specify a command")
  }
}
