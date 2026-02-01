import z from "zod"
import { randomBytes } from "crypto"

export namespace Task {
  export const Status = z.enum(["pending", "running", "done", "failed", "cancelled"])
  export type Status = z.infer<typeof Status>

  export const Thinking = z.enum(["low", "medium", "high", "xhigh"])
  export type Thinking = z.infer<typeof Thinking>

  export const Meta = z
    .object({
      id: z.string(),
      status: Status.default("pending"),
      agentClass: z.string().optional(),
      model: z.string().optional(),
      thinking: Thinking.optional(),
      allow: z.array(z.string()).default([]),
      timeout: z.number().optional(),
      depends: z.array(z.string()).default([]),
      created: z.string(),
      started: z.string().optional(),
      finished: z.string().optional(),
    })
    .meta({ ref: "HydraTaskMeta" })
  export type Meta = z.infer<typeof Meta>

  export const Info = z
    .object({
      meta: Meta,
      title: z.string(),
      description: z.string(),
      output: z.string().optional(),
      filesChanged: z.array(z.string()).optional(),
    })
    .meta({ ref: "HydraTask" })
  export type Info = z.infer<typeof Info>

  export function generateId(): string {
    const time = Date.now().toString(36)
    const rand = randomBytes(8).toString("hex")
    return `t${time}${rand}`
  }

  export function create(input: {
    title: string
    description: string
    agentClass?: string
    model?: string
    thinking?: Thinking
    allow?: string[]
    timeout?: number
    depends?: string[]
  }): Info {
    return Info.parse({
      meta: {
        id: generateId(),
        agentClass: input.agentClass,
        model: input.model,
        thinking: input.thinking,
        allow: input.allow,
        timeout: input.timeout,
        depends: input.depends,
        created: new Date().toISOString(),
      },
      title: input.title,
      description: input.description,
    })
  }
}
