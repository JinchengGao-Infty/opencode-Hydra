import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import z from "zod"
import yaml from "yaml"

export namespace HydraConfig {
  export const Thinking = z.enum(["low", "medium", "high"])
  export type Thinking = z.infer<typeof Thinking>

  const Provider = z.object({
    endpoint: z.string().optional(),
    apiKey: z.string().optional(),
  })

  const Class = z.object({
    description: z.string().optional(),
    model: z.string().optional(),
    thinking: Thinking.optional(),
    prompt: z.string().optional(),
  })
  export type Class = z.infer<typeof Class>

  const Defaults = z.object({
    model: z.string().default("anthropic/claude-sonnet"),
    thinking: Thinking.default("medium"),
    timeout: z.number().int().positive().default(3600),
    maxAgents: z.number().int().positive().default(3),
  })

  const Scheduler = z.object({
    autoStart: z.boolean().default(false),
    retryOnFail: z.boolean().default(true),
    maxRetries: z.number().int().min(0).default(2),
  })

  const Info = z.object({
    providers: z.record(z.string(), Provider).default({}),
    classes: z.record(z.string(), Class).default({}),
    defaults: Defaults.default({}),
    scheduler: Scheduler.default({}),
  })
  export type Config = z.infer<typeof Info>

  const DefaultsLayer = z.object({
    model: z.string().optional(),
    thinking: Thinking.optional(),
    timeout: z.number().int().positive().optional(),
    maxAgents: z.number().int().positive().optional(),
  })

  const SchedulerLayer = z.object({
    autoStart: z.boolean().optional(),
    retryOnFail: z.boolean().optional(),
    maxRetries: z.number().int().min(0).optional(),
  })

  const Layer = z.object({
    providers: z.record(z.string(), Provider).optional(),
    classes: z.record(z.string(), Class).optional(),
    defaults: DefaultsLayer.optional(),
    scheduler: SchedulerLayer.optional(),
  })
  type Layer = z.infer<typeof Layer>

  const Legacy = z.object({
    classes: z.record(
      z.string(),
      z.object({
        description: z.string(),
        prompt: z.string(),
        defaultModel: z.string(),
        defaultThinking: Thinking,
      }),
    ),
  })

  let cfg: Config | undefined

  export function load(projectRoot: string): Config {
    const base = Info.parse({})
    const next = merge(merge(merge(base, read(globalPath())), readLegacy(projectRoot)), read(projectPath(projectRoot)))
    cfg = next
    return next
  }

  export function save(projectRoot: string, config: Config): void {
    const dir = path.join(projectRoot, ".hydra")
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })

    const file = projectPath(projectRoot)
    const text = yaml.stringify(config)
    fs.writeFileSync(file, text, "utf8")
  }

  export function get<K extends keyof Config>(key: K): Config[K] {
    const val = cfg
    if (!val) throw new Error("HydraConfig.get: not loaded")
    return val[key]
  }

  export function set<K extends keyof Config>(key: K, value: Config[K]): void {
    const val = cfg
    if (!val) throw new Error("HydraConfig.set: not loaded")
    cfg = Info.parse({ ...val, [key]: value })
  }

  function merge(base: Config, layer: Layer): Config {
    const prov = { ...base.providers }
    for (const entry of Object.entries(layer.providers ?? {})) {
      const key = entry[0]
      const val = entry[1]
      prov[key] = { ...prov[key], ...val }
    }

    const cls = { ...base.classes }
    for (const entry of Object.entries(layer.classes ?? {})) {
      const key = entry[0]
      const val = entry[1]
      cls[key] = { ...cls[key], ...val }
    }

    const defs = { ...base.defaults, ...(layer.defaults ?? {}) }
    const sch = { ...base.scheduler, ...(layer.scheduler ?? {}) }
    return Info.parse({ ...base, providers: prov, classes: cls, defaults: defs, scheduler: sch })
  }

  function read(file: string): Layer {
    if (!fs.existsSync(file)) return {}
    const text = fs.readFileSync(file, "utf8")
    const data = yaml.parse(text) ?? {}
    return Layer.parse(data)
  }

  function readLegacy(projectRoot: string): Layer {
    const file = legacyPath(projectRoot)
    if (!fs.existsSync(file)) return {}
    const text = fs.readFileSync(file, "utf8")
    const data = yaml.parse(text) ?? {}
    const parsed = Legacy.parse(data)

    const classes: Record<string, Class> = {}
    for (const entry of Object.entries(parsed.classes)) {
      const name = entry[0]
      const val = entry[1]
      classes[name] = Class.parse({
        description: val.description,
        prompt: val.prompt,
        model: val.defaultModel,
        thinking: val.defaultThinking,
      })
    }

    return { classes }
  }

  function projectPath(projectRoot: string): string {
    return path.join(projectRoot, ".hydra", "config.yaml")
  }

  function legacyPath(projectRoot: string): string {
    return path.join(projectRoot, ".hydra", "agents.yaml")
  }

  function globalPath(): string {
    const home = process.env.OPENCODE_TEST_HOME || os.homedir()
    return path.join(home, ".config", "opencode", "hydra.yaml")
  }
}
