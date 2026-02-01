import z from "zod"
import path from "node:path"
import yaml from "yaml"
import { HydraConfig } from "../config"

import PROMPT_CODER from "./prompts/coder.txt"
import PROMPT_ARCHITECT from "./prompts/architect.txt"
import PROMPT_WRITER from "./prompts/writer.txt"
import PROMPT_REVIEWER from "./prompts/reviewer.txt"
import PROMPT_CODEX from "./prompts/codex.txt"

export namespace AgentClass {
  export const Thinking = z.enum(["low", "medium", "high", "xhigh"])
  export type Thinking = z.infer<typeof Thinking>

  export const Info = z.object({
    name: z.string(),
    description: z.string(),
    prompt: z.string(),
    defaultModel: z.string(),
    defaultThinking: Thinking,
    workflow: z.string().optional(),
    systemPrompt: z.string().optional(),
    tools: z.array(z.string()).optional(),
    timeout: z.number().optional(),
    retryOnFail: z.boolean().optional(),
    maxRetries: z.number().optional(),
  })
  export type Info = z.infer<typeof Info>

  export const BUILTIN: Record<string, Info> = {
    Coder: {
      name: "Coder",
      description: "写代码的 Agent，擅长实现功能、修复 bug、写测试",
      prompt: PROMPT_CODER,
      defaultModel: "anthropic/claude-sonnet",
      defaultThinking: "medium",
    },
    Codex: {
      name: "Codex",
      description: "深度思考的编程 Agent，质量优先，擅长复杂修改与自测自查",
      prompt: PROMPT_CODEX,
      defaultModel: "openai/codex",
      defaultThinking: "high",
      timeout: 7200,
      workflow: [
        "1. 阅读任务文档（tasks/tXXX.md）",
        "2. 分析现有代码结构",
        "3. 制定实现计划",
        "4. 逐步实现，边做边测试",
        "5. 完成后自我审查",
        "6. 不要提交 git（由主控处理）",
      ].join("\n"),
    },
    Architect: {
      name: "Architect",
      description: "架构设计 Agent，擅长系统设计、技术选型、代码审查",
      prompt: PROMPT_ARCHITECT,
      defaultModel: "anthropic/claude-opus",
      defaultThinking: "high",
    },
    Writer: {
      name: "Writer",
      description: "文档 Agent，擅长写文档、注释、README",
      prompt: PROMPT_WRITER,
      defaultModel: "google/gemini-2",
      defaultThinking: "low",
    },
    Reviewer: {
      name: "Reviewer",
      description: "代码审查 Agent，擅长发现问题、提出改进建议",
      prompt: PROMPT_REVIEWER,
      defaultModel: "anthropic/claude-opus",
      defaultThinking: "high",
    },
  }

  let classes: Record<string, Info> = BUILTIN

  export function register(custom?: Record<string, HydraConfig.Class>, defaults?: HydraConfig.Config["defaults"]): void {
    const defs = defaults ?? { model: "anthropic/claude-sonnet", thinking: "medium" as const, timeout: 3600, maxAgents: 3 }
    const out: Record<string, Info> = { ...BUILTIN }

    for (const entry of Object.entries(custom ?? {})) {
      const name = entry[0]
      const cfg = entry[1]
      const base = BUILTIN[name]
      const replace = !base || Boolean(cfg.description)

      if (!replace) {
        const prompt = cfg.prompt ? [base.prompt, cfg.prompt].join("\n\n") : base.prompt
        out[name] = Info.parse({
          ...base,
          prompt,
          defaultModel: cfg.model ?? base.defaultModel,
          defaultThinking: cfg.thinking ?? base.defaultThinking,
          workflow: cfg.workflow ?? base.workflow,
          systemPrompt: cfg.systemPrompt ?? base.systemPrompt,
          tools: cfg.tools ?? base.tools,
          timeout: cfg.timeout ?? base.timeout,
          retryOnFail: cfg.retryOnFail ?? base.retryOnFail,
          maxRetries: cfg.maxRetries ?? base.maxRetries,
        })
        continue
      }

      out[name] = Info.parse({
        name,
        description: cfg.description ?? base?.description ?? name,
        prompt: cfg.prompt ?? base?.prompt ?? "",
        defaultModel: cfg.model ?? base?.defaultModel ?? defs.model,
        defaultThinking: cfg.thinking ?? base?.defaultThinking ?? defs.thinking,
        workflow: cfg.workflow ?? base?.workflow,
        systemPrompt: cfg.systemPrompt ?? base?.systemPrompt,
        tools: cfg.tools ?? base?.tools,
        timeout: cfg.timeout ?? base?.timeout,
        retryOnFail: cfg.retryOnFail ?? base?.retryOnFail,
        maxRetries: cfg.maxRetries ?? base?.maxRetries,
      })
    }

    classes = out
  }

  const Config = z.object({
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

  export async function loadCustom(projectRoot: string): Promise<Record<string, Info>> {
    const file = path.join(projectRoot, ".hydra/agents.yaml")
    const ok = await Bun.file(file).exists()
    if (!ok) return {}

    const text = await Bun.file(file).text()
    const parsed = Config.parse(yaml.parse(text))

    const out: Record<string, Info> = {}
    for (const entry of Object.entries(parsed.classes)) {
      const name = entry[0]
      const val = entry[1]
      out[name] = Info.parse({
        name,
        description: val.description,
        prompt: val.prompt,
        defaultModel: val.defaultModel,
        defaultThinking: val.defaultThinking,
      })
    }

    return out
  }

  export async function list(projectRoot: string): Promise<Info[]> {
    const cfg = HydraConfig.load(projectRoot)
    register(cfg.classes, cfg.defaults)
    return Object.values(classes)
  }

  export async function get(projectRoot: string, name: string): Promise<Info | undefined> {
    const cfg = HydraConfig.load(projectRoot)
    register(cfg.classes, cfg.defaults)
    return classes[name]
  }

  export async function exists(projectRoot: string, name: string): Promise<boolean> {
    const info = await get(projectRoot, name)
    return Boolean(info)
  }
}
