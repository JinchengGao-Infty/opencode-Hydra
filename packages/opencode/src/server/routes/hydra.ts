import { Hono } from "hono"
import { describeRoute, resolver, validator } from "hono-openapi"
import z from "zod"
import { AgentManager } from "../../hydra/agent/manager"
import { AgentInstance } from "../../hydra/agent/instance"
import { HydraCore } from "../../hydra/core"
import { Task } from "../../hydra/task/task"
import { TaskManager } from "../../hydra/task/manager"
import { Instance } from "../../project/instance"
import { lazy } from "../../util/lazy"
import { errors } from "../error"

const Status = z
  .object({
    running: z.boolean(),
    config: z
      .object({
        projectRoot: z.string(),
        maxAgents: z.number(),
        pollInterval: z.number(),
        defaultTimeout: z.number(),
      })
      .optional(),
    tasks: z.object({
      total: z.number(),
      pending: z.number(),
      running: z.number(),
      done: z.number(),
      failed: z.number(),
      cancelled: z.number(),
    }),
    agents: z.object({
      total: z.number(),
      running: z.number(),
      waiting: z.number(),
      paused: z.number(),
    }),
  })
  .meta({ ref: "HydraStatus" })

const TaskList = z
  .object({
    tasks: z.array(Task.Info),
  })
  .meta({ ref: "HydraTaskList" })

const AgentList = z
  .object({
    agents: z.array(AgentInstance.Info),
  })
  .meta({ ref: "HydraAgentList" })

const AgentLogs = z
  .object({
    text: z.string(),
  })
  .meta({ ref: "HydraAgentLogs" })

async function ensure(root: string) {
  const status = await HydraCore.getStatus()
  if (status.config?.projectRoot === root) return status

  await HydraCore.init(root)
  return HydraCore.getStatus()
}

export const HydraRoutes = lazy(() =>
  new Hono()
    .get(
      "/status",
      describeRoute({
        summary: "Get Hydra status",
        description: "Retrieve current Hydra scheduler state and basic counts.",
        operationId: "hydra.status",
        responses: {
          200: {
            description: "Hydra status",
            content: {
              "application/json": {
                schema: resolver(Status),
              },
            },
          },
        },
      }),
      async (c) => {
        const status = await ensure(Instance.directory)
        return c.json(status)
      },
    )
    .get(
      "/task",
      describeRoute({
        summary: "List Hydra tasks",
        description: "List Hydra tasks for the current project (optionally filtered by status).",
        operationId: "hydra.task.list",
        responses: {
          200: {
            description: "Hydra tasks",
            content: {
              "application/json": {
                schema: resolver(TaskList),
              },
            },
          },
          ...errors(400),
        },
      }),
      validator(
        "query",
        z.object({
          status: Task.Status.optional(),
        }),
      ),
      async (c) => {
        const query = c.req.valid("query")
        const list = await TaskManager.list(Instance.directory)
        const tasks = query.status ? list.filter((task) => task.meta.status === query.status) : list
        return c.json({ tasks })
      },
    )
    .get(
      "/agent",
      describeRoute({
        summary: "List Hydra agents",
        description: "List Hydra agents (optionally filtered by status).",
        operationId: "hydra.agent.list",
        responses: {
          200: {
            description: "Hydra agents",
            content: {
              "application/json": {
                schema: resolver(AgentList),
              },
            },
          },
          ...errors(400),
        },
      }),
      validator(
        "query",
        z.object({
          status: AgentInstance.Status.optional(),
        }),
      ),
      async (c) => {
        const query = c.req.valid("query")
        const list = AgentManager.list()
        const agents = query.status ? list.filter((agent) => agent.status === query.status) : list
        return c.json({ agents })
      },
    )
    .get(
      "/agent/:id/logs",
      describeRoute({
        summary: "Get Hydra agent logs",
        description: "Get Hydra agent logs (tail N lines).",
        operationId: "hydra.agent.logs",
        responses: {
          200: {
            description: "Hydra agent logs",
            content: {
              "application/json": {
                schema: resolver(AgentLogs),
              },
            },
          },
          ...errors(400, 404),
        },
      }),
      validator(
        "param",
        z.object({
          id: z.string(),
        }),
      ),
      validator(
        "query",
        z.object({
          lines: z.coerce.number().int().positive().optional(),
          follow: z.coerce.boolean().optional(),
        }),
      ),
      async (c) => {
        const param = c.req.valid("param")
        const query = c.req.valid("query")
        const text = await AgentManager.logs(param.id, { lines: query.lines, follow: query.follow })
        return c.json({ text })
      },
    )
    .post(
      "/agent/:id/send",
      describeRoute({
        summary: "Send message to Hydra agent",
        description: "Send a message to a running Hydra agent process.",
        operationId: "hydra.agent.send",
        responses: {
          200: {
            description: "Message sent",
            content: {
              "application/json": {
                schema: resolver(z.boolean()),
              },
            },
          },
          ...errors(400, 404),
        },
      }),
      validator(
        "param",
        z.object({
          id: z.string(),
        }),
      ),
      validator(
        "json",
        z.object({
          message: z.string(),
        }),
      ),
      async (c) => {
        const param = c.req.valid("param")
        const body = c.req.valid("json")
        await AgentManager.send(param.id, body.message, { from: "user" })
        return c.json(true)
      },
    )
    .post(
      "/agent/:id/pause",
      describeRoute({
        summary: "Pause Hydra agent",
        description: "Pause a running Hydra agent process.",
        operationId: "hydra.agent.pause",
        responses: {
          200: {
            description: "Agent paused",
            content: {
              "application/json": {
                schema: resolver(z.boolean()),
              },
            },
          },
          ...errors(400, 404),
        },
      }),
      validator(
        "param",
        z.object({
          id: z.string(),
        }),
      ),
      async (c) => {
        const param = c.req.valid("param")
        await AgentManager.pause(param.id)
        return c.json(true)
      },
    )
    .post(
      "/agent/:id/resume",
      describeRoute({
        summary: "Resume Hydra agent",
        description: "Resume a paused Hydra agent process.",
        operationId: "hydra.agent.resume",
        responses: {
          200: {
            description: "Agent resumed",
            content: {
              "application/json": {
                schema: resolver(z.boolean()),
              },
            },
          },
          ...errors(400, 404),
        },
      }),
      validator(
        "param",
        z.object({
          id: z.string(),
        }),
      ),
      async (c) => {
        const param = c.req.valid("param")
        await AgentManager.resume(param.id)
        return c.json(true)
      },
    )
    .post(
      "/agent/:id/kill",
      describeRoute({
        summary: "Kill Hydra agent",
        description: "Kill a Hydra agent process (optionally cleanup worktree).",
        operationId: "hydra.agent.kill",
        responses: {
          200: {
            description: "Agent killed",
            content: {
              "application/json": {
                schema: resolver(z.boolean()),
              },
            },
          },
          ...errors(400, 404),
        },
      }),
      validator(
        "param",
        z.object({
          id: z.string(),
        }),
      ),
      validator(
        "json",
        z.object({
          cleanup: z.boolean().optional(),
        }),
      ),
      async (c) => {
        const param = c.req.valid("param")
        const body = c.req.valid("json")
        await AgentManager.kill(param.id, { cleanup: body.cleanup })
        return c.json(true)
      },
    ),
)

