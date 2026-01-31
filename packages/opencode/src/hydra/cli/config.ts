import type { Argv } from "yargs"
import yaml from "yaml"
import { UI } from "../../cli/ui"
import { HydraConfig } from "../config"

export namespace ConfigCommands {
  export function register(yargs: Argv) {
    return yargs
      .command("show", "Show current config (merged)", (yargs: Argv) => yargs.option("json", { type: "boolean", default: false }), handleShow)
      .command(
        "set <path> <value>",
        "Set a config value",
        (yargs: Argv) => yargs.positional("path", { type: "string", demandOption: true }).positional("value", { type: "string", demandOption: true }),
        handleSet,
      )
      .command(
        "add-class <name>",
        "Add or update a custom agent class",
        (yargs: Argv) =>
          yargs
            .positional("name", { type: "string", demandOption: true })
            .option("description", { alias: ["d"], type: "string" })
            .option("model", { alias: ["m"], type: "string", demandOption: true })
            .option("thinking", { type: "string", choices: HydraConfig.Thinking.options })
            .option("prompt", { alias: ["p"], type: "string", demandOption: true }),
        handleAddClass,
      )
      .demandCommand(1)
  }
}

async function handleShow(args: { json: boolean }) {
  const root = process.cwd()
  const cfg = HydraConfig.load(root)

  if (args.json) {
    process.stdout.write(JSON.stringify(cfg, null, 2) + "\n")
    return
  }

  process.stdout.write(yaml.stringify(cfg))
}

async function handleSet(args: { path: string; value: string }) {
  const root = process.cwd()
  const cfg = HydraConfig.load(root)
  const next = set(cfg, args.path, args.value)
  HydraConfig.save(root, next)
  process.stdout.write("ok\n")
}

async function handleAddClass(args: { name: string; description?: string; model: string; thinking?: string; prompt: string }) {
  const root = process.cwd()
  const cfg = HydraConfig.load(root)

  const next: HydraConfig.Config = {
    ...cfg,
    classes: {
      ...cfg.classes,
      [args.name]: {
        description: args.description,
        model: args.model,
        thinking: args.thinking ? HydraConfig.Thinking.parse(args.thinking) : undefined,
        prompt: args.prompt,
      },
    },
  }

  HydraConfig.save(root, next)
  process.stdout.write("ok\n")
}

function set(cfg: HydraConfig.Config, key: string, raw: string): HydraConfig.Config {
  const parts = key.split(".").filter(Boolean)
  if (parts.length === 0) throw new Error("config set: missing path")

  if (parts[0] === "defaults") return setDefaults(cfg, parts, raw)
  if (parts[0] === "scheduler") return setScheduler(cfg, parts, raw)
  if (parts[0] === "providers") return setProviders(cfg, parts, raw)
  if (parts[0] === "classes") return setClasses(cfg, parts, raw)

  throw new Error(`config set: unsupported path: ${key}`)
}

function setDefaults(cfg: HydraConfig.Config, parts: string[], raw: string): HydraConfig.Config {
  if (parts.length !== 2) throw new Error(`config set: invalid defaults path: ${parts.join(".")}`)
  const key = parts[1]

  if (key === "model") {
    return { ...cfg, defaults: { ...cfg.defaults, model: raw } }
  }

  if (key === "thinking") {
    return { ...cfg, defaults: { ...cfg.defaults, thinking: HydraConfig.Thinking.parse(raw) } }
  }

  const num = number(raw)
  if (key === "timeout") return { ...cfg, defaults: { ...cfg.defaults, timeout: num } }
  if (key === "maxAgents") return { ...cfg, defaults: { ...cfg.defaults, maxAgents: num } }

  throw new Error(`config set: unknown defaults key: ${key}`)
}

function setScheduler(cfg: HydraConfig.Config, parts: string[], raw: string): HydraConfig.Config {
  if (parts.length !== 2) throw new Error(`config set: invalid scheduler path: ${parts.join(".")}`)
  const key = parts[1]

  if (key === "autoStart") return { ...cfg, scheduler: { ...cfg.scheduler, autoStart: boolean(raw) } }
  if (key === "retryOnFail") return { ...cfg, scheduler: { ...cfg.scheduler, retryOnFail: boolean(raw) } }
  if (key === "maxRetries") return { ...cfg, scheduler: { ...cfg.scheduler, maxRetries: number(raw) } }

  throw new Error(`config set: unknown scheduler key: ${key}`)
}

function setProviders(cfg: HydraConfig.Config, parts: string[], raw: string): HydraConfig.Config {
  if (parts.length !== 3) throw new Error(`config set: invalid providers path: ${parts.join(".")}`)
  const name = parts[1]
  const key = parts[2]
  const prev = cfg.providers[name] ?? {}

  if (key === "endpoint") return { ...cfg, providers: { ...cfg.providers, [name]: { ...prev, endpoint: raw } } }
  if (key === "apiKey") return { ...cfg, providers: { ...cfg.providers, [name]: { ...prev, apiKey: raw } } }

  throw new Error(`config set: unknown provider key: ${key}`)
}

function setClasses(cfg: HydraConfig.Config, parts: string[], raw: string): HydraConfig.Config {
  if (parts.length !== 3) throw new Error(`config set: invalid classes path: ${parts.join(".")}`)
  const name = parts[1]
  const key = parts[2]
  const prev = cfg.classes[name] ?? {}

  if (key === "description") return { ...cfg, classes: { ...cfg.classes, [name]: { ...prev, description: raw } } }
  if (key === "model") return { ...cfg, classes: { ...cfg.classes, [name]: { ...prev, model: raw } } }
  if (key === "thinking") return { ...cfg, classes: { ...cfg.classes, [name]: { ...prev, thinking: HydraConfig.Thinking.parse(raw) } } }
  if (key === "prompt") return { ...cfg, classes: { ...cfg.classes, [name]: { ...prev, prompt: raw } } }

  throw new Error(`config set: unknown class key: ${key}`)
}

function boolean(raw: string): boolean {
  if (raw === "true") return true
  if (raw === "false") return false
  UI.error(`Invalid boolean: ${raw}`)
  process.exitCode = 1
  throw new Error(`Invalid boolean: ${raw}`)
}

function number(raw: string): number {
  const val = Number(raw)
  if (!Number.isFinite(val)) {
    UI.error(`Invalid number: ${raw}`)
    process.exitCode = 1
    throw new Error(`Invalid number: ${raw}`)
  }
  return val
}
