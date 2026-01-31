import { randomBytes } from "crypto"
import z from "zod"
import { AgentClass } from "./class"

export namespace AgentInstance {
  export const Status = z.enum(["idle", "running", "paused", "waiting", "done", "failed"])
  export type Status = z.infer<typeof Status>

  export const Info = z.object({
    id: z.string(),
    class: z.string(),
    name: z.string(),
    model: z.string(),
    thinking: AgentClass.Thinking,
    worktree: z.string(),
    taskId: z.string().optional(),
    status: Status,
    pid: z.number().optional(),
    created: z.string(),
    started: z.string().optional(),
    finished: z.string().optional(),
  })
  export type Info = z.infer<typeof Info>

  export function generateId(): string {
    const time = Date.now().toString(36)
    const rand = randomBytes(8).toString("hex")
    return `a${time}${rand}`
  }

  export function create(input: {
    class: string
    name: string
    model: string
    thinking: AgentClass.Thinking
    worktree: string
    taskId?: string
  }): Info {
    return Info.parse({
      id: generateId(),
      class: input.class,
      name: input.name,
      model: input.model,
      thinking: input.thinking,
      worktree: input.worktree,
      taskId: input.taskId,
      status: "idle",
      created: new Date().toISOString(),
    })
  }
}

