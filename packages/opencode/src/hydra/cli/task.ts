import type { Argv } from "yargs"
import { UI } from "../../cli/ui"
import { Task, TaskManager } from "../task"
import { Format } from "./format"

export namespace TaskCommands {
  export function register(yargs: Argv) {
    return yargs
      .command(
        "create <title>",
        "Create a new task",
        (yargs: Argv) =>
          yargs
            .positional("title", { type: "string", demandOption: true })
            .option("description", { alias: ["d"], type: "string", default: "" })
            .option("class", { alias: ["c"], type: "string", describe: "Agent class" })
            .option("model", { alias: ["m"], type: "string" })
            .option("thinking", { type: "string", choices: Task.Thinking.options })
            .option("allow", { type: "string", array: true, default: [] })
            .option("timeout", { type: "number" })
            .option("depends", { type: "string", array: true, default: [] }),
        handleCreate,
      )
      .command(
        "list",
        "List all tasks",
        (yargs: Argv) =>
          yargs
            .option("status", { alias: ["s"], type: "string", array: true, choices: Task.Status.options })
            .option("json", { type: "boolean", default: false }),
        handleList,
      )
      .command(
        "show <id>",
        "Show task details",
        (yargs: Argv) =>
          yargs.positional("id", { type: "string", demandOption: true }).option("json", { type: "boolean", default: false }),
        handleShow,
      )
      .command(
        "cancel <id>",
        "Cancel a task",
        (yargs: Argv) => yargs.positional("id", { type: "string", demandOption: true }),
        handleCancel,
      )
      .demandCommand(1)
  }
}

async function handleCreate(args: {
  title: string
  description: string
  class?: string
  model?: string
  thinking?: Task.Thinking
  allow: string[]
  timeout?: number
  depends: string[]
}) {
  const root = process.cwd()
  const task = await TaskManager.create(root, {
    title: args.title,
    description: args.description,
    agentClass: args.class,
    model: args.model,
    thinking: args.thinking,
    allow: args.allow,
    timeout: args.timeout,
    depends: args.depends,
  }).catch((err) => {
    fail(err)
    return
  })

  if (!task) return
  process.stdout.write(Format.taskCreated(task) + "\n")
}

async function handleList(args: { status?: string[]; json: boolean }) {
  const root = process.cwd()
  const filter = args.status?.length ? { status: args.status as Task.Status[] } : undefined
  const tasks = await TaskManager.list(root, filter).catch((err) => {
    fail(err)
    return
  })
  if (!tasks) return

  if (args.json) {
    process.stdout.write(JSON.stringify(tasks, null, 2) + "\n")
    return
  }

  process.stdout.write(Format.taskList(tasks) + "\n")
}

async function handleShow(args: { id: string; json: boolean }) {
  const root = process.cwd()
  const task = await TaskManager.get(root, args.id).catch((err) => {
    fail(err)
    return
  })
  if (!task) {
    UI.error(`Task not found: ${args.id}`)
    process.exitCode = 1
    return
  }

  if (args.json) {
    process.stdout.write(JSON.stringify(task, null, 2) + "\n")
    return
  }

  process.stdout.write(Format.taskDetail(task) + "\n")
}

async function handleCancel(args: { id: string }) {
  const root = process.cwd()
  const task = await TaskManager.cancel(root, args.id).catch((err) => {
    fail(err)
    return
  })
  if (!task) return
  process.stdout.write(Format.taskCancelled(task) + "\n")
}

function fail(err: unknown) {
  UI.error(err instanceof Error ? err.message : String(err))
  process.exitCode = 1
}
