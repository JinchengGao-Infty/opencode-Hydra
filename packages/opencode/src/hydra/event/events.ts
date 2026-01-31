import z from "zod"

export namespace HydraEvent {
  export interface Event<T> {
    type: string
    schema: z.ZodType<T>
  }

  export function define<Type extends string, T>(type: Type, schema: z.ZodType<T>): Event<T> {
    return {
      type,
      schema,
    }
  }

  export const TaskCreated = define(
    "hydra.task.created",
    z.object({
      taskId: z.string(),
      title: z.string(),
    }),
  )

  export const TaskStarted = define(
    "hydra.task.started",
    z.object({
      taskId: z.string(),
      agentId: z.string(),
    }),
  )

  export const TaskProgress = define(
    "hydra.task.progress",
    z.object({
      taskId: z.string(),
      agentId: z.string(),
      message: z.string(),
    }),
  )

  export const TaskCompleted = define(
    "hydra.task.completed",
    z.object({
      taskId: z.string(),
      agentId: z.string(),
      output: z.string(),
      filesChanged: z.array(z.string()),
    }),
  )

  export const TaskFailed = define(
    "hydra.task.failed",
    z.object({
      taskId: z.string(),
      agentId: z.string().optional(),
      error: z.string(),
    }),
  )

  export const TaskCancelled = define(
    "hydra.task.cancelled",
    z.object({
      taskId: z.string(),
      reason: z.string().optional(),
    }),
  )

  export const AgentSpawned = define(
    "hydra.agent.spawned",
    z.object({
      agentId: z.string(),
      class: z.string(),
      name: z.string(),
      worktree: z.string(),
    }),
  )

  export const AgentStarted = define(
    "hydra.agent.started",
    z.object({
      agentId: z.string(),
      taskId: z.string(),
    }),
  )

  export const AgentPaused = define(
    "hydra.agent.paused",
    z.object({
      agentId: z.string(),
    }),
  )

  export const AgentResumed = define(
    "hydra.agent.resumed",
    z.object({
      agentId: z.string(),
    }),
  )

  export const AgentWaiting = define(
    "hydra.agent.waiting",
    z.object({
      agentId: z.string(),
      taskId: z.string().optional(),
      reason: z.string(),
    }),
  )

  export const AgentMessage = define(
    "hydra.agent.message",
    z.object({
      agentId: z.string(),
      message: z.string(),
      from: z.enum(["user", "master"]),
    }),
  )

  export const AgentOutput = define(
    "hydra.agent.output",
    z.object({
      agentId: z.string(),
      text: z.string(),
      stream: z.enum(["stdout", "stderr"]).optional(),
    }),
  )

  export const AgentCompleted = define(
    "hydra.agent.completed",
    z.object({
      agentId: z.string(),
      taskId: z.string().optional(),
      output: z.string().optional(),
    }),
  )

  export const AgentFailed = define(
    "hydra.agent.failed",
    z.object({
      agentId: z.string(),
      taskId: z.string().optional(),
      error: z.string(),
    }),
  )

  export const AgentKilled = define(
    "hydra.agent.killed",
    z.object({
      agentId: z.string(),
      reason: z.string().optional(),
    }),
  )
}
