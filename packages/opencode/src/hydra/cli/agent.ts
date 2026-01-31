import type { Argv } from "yargs"
import { UI } from "../../cli/ui"
import { AgentClass, AgentInstance, AgentManager } from "../agent"
import { Format } from "./format"

export namespace AgentCommands {
  export function register(yargs: Argv) {
    return yargs
      .command(
        "spawn <class>",
        "Spawn a new agent",
        (yargs: Argv) =>
          yargs
            .positional("class", { type: "string", demandOption: true })
            .option("name", { alias: ["n"], type: "string" })
            .option("model", { alias: ["m"], type: "string" })
            .option("thinking", { type: "string", choices: AgentClass.Thinking.options })
            .option("task", { alias: ["t"], type: "string", describe: "Task ID to assign" }),
        handleSpawn,
      )
      .command(
        "list",
        "List all agents",
        (yargs: Argv) =>
          yargs
            .option("status", { alias: ["s"], type: "string", array: true, choices: AgentInstance.Status.options })
            .option("json", { type: "boolean", default: false }),
        handleList,
      )
      .command(
        "show <id>",
        "Show agent details",
        (yargs: Argv) =>
          yargs.positional("id", { type: "string", demandOption: true }).option("json", { type: "boolean", default: false }),
        handleShow,
      )
      .command(
        "logs <id>",
        "View agent logs",
        (yargs: Argv) =>
          yargs
            .positional("id", { type: "string", demandOption: true })
            .option("follow", { alias: ["f"], type: "boolean", default: false })
            .option("lines", { alias: ["n"], type: "number" }),
        handleLogs,
      )
      .command(
        "send <id> <message>",
        "Send message to agent",
        (yargs: Argv) =>
          yargs
            .positional("id", { type: "string", demandOption: true })
            .positional("message", { type: "string", demandOption: true }),
        handleSend,
      )
      .command(
        "pause <id>",
        "Pause an agent",
        (yargs: Argv) => yargs.positional("id", { type: "string", demandOption: true }),
        handlePause,
      )
      .command(
        "resume <id>",
        "Resume a paused agent",
        (yargs: Argv) => yargs.positional("id", { type: "string", demandOption: true }),
        handleResume,
      )
      .command(
        "kill <id>",
        "Kill an agent",
        (yargs: Argv) =>
          yargs
            .positional("id", { type: "string", demandOption: true })
            .option("cleanup", { type: "boolean", default: false, describe: "Remove worktree" }),
        handleKill,
      )
      .command(
        "classes",
        "List available agent classes",
        (yargs: Argv) => yargs.option("json", { type: "boolean", default: false }),
        handleClasses,
      )
      .demandCommand(1)
  }
}

async function handleSpawn(args: {
  class: string
  name?: string
  model?: string
  thinking?: AgentClass.Thinking
  task?: string
}) {
  const root = process.cwd()
  const agent = await AgentManager.spawn(root, {
    class: args.class,
    name: args.name,
    model: args.model,
    thinking: args.thinking,
    taskId: args.task,
  }).catch((err) => {
    fail(err)
    return
  })

  if (!agent) return
  process.stdout.write(Format.agentSpawned(agent) + "\n")
}

async function handleList(args: { status?: string[]; json: boolean }) {
  const filter = args.status?.length ? { status: args.status as AgentInstance.Status[] } : undefined
  const agents = AgentManager.list(filter)

  if (args.json) {
    process.stdout.write(JSON.stringify(agents, null, 2) + "\n")
    return
  }

  process.stdout.write(Format.agentList(agents) + "\n")
}

async function handleShow(args: { id: string; json: boolean }) {
  const agent = AgentManager.get(args.id)
  if (!agent) {
    UI.error(`Agent not found: ${args.id}`)
    process.exitCode = 1
    return
  }

  if (args.json) {
    process.stdout.write(JSON.stringify(agent, null, 2) + "\n")
    return
  }

  process.stdout.write(Format.agentDetail(agent) + "\n")
}

async function handleLogs(args: { id: string; follow: boolean; lines?: number }) {
  const logs = await AgentManager.logs(args.id, { follow: args.follow, lines: args.lines }).catch((err) => {
    fail(err)
    return
  })
  if (logs === undefined) return
  process.stdout.write(logs + "\n")
}

async function handleSend(args: { id: string; message: string }) {
  const ok = await AgentManager.send(args.id, args.message).then(
    () => true,
    (err) => {
      fail(err)
      return false
    },
  )
  if (!ok) return
  process.stdout.write(`Message sent to agent ${args.id}\n`)
}

async function handlePause(args: { id: string }) {
  const ok = await AgentManager.pause(args.id).then(
    () => true,
    (err) => {
      fail(err)
      return false
    },
  )
  if (!ok) return
  process.stdout.write(`Agent ${args.id} paused\n`)
}

async function handleResume(args: { id: string }) {
  const ok = await AgentManager.resume(args.id).then(
    () => true,
    (err) => {
      fail(err)
      return false
    },
  )
  if (!ok) return
  process.stdout.write(`Agent ${args.id} resumed\n`)
}

async function handleKill(args: { id: string; cleanup: boolean }) {
  const ok = await AgentManager.kill(args.id, { cleanup: args.cleanup }).then(
    () => true,
    (err) => {
      fail(err)
      return false
    },
  )
  if (!ok) return
  process.stdout.write(`Agent ${args.id} killed\n`)
}

async function handleClasses(args: { json: boolean }) {
  const root = process.cwd()
  const classes = await AgentClass.list(root).catch((err) => {
    fail(err)
    return
  })
  if (!classes) return

  if (args.json) {
    process.stdout.write(JSON.stringify(classes, null, 2) + "\n")
    return
  }

  process.stdout.write(Format.classList(classes) + "\n")
}

function fail(err: unknown) {
  UI.error(err instanceof Error ? err.message : String(err))
  process.exitCode = 1
}
