import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import z from "zod/v4"
import { HydraCore } from "../hydra/core"
import { TaskManager } from "../hydra/task/manager"
import { AgentManager } from "../hydra/agent/manager"
import { Installation } from "../installation"

const taskStatus = ["pending", "running", "done", "failed", "cancelled"] as const
const agentStatus = ["idle", "running", "paused", "waiting", "done", "failed"] as const
const thinking = ["low", "medium", "high"] as const
const callbackEvent = ["completed", "failed", "waiting"] as const

const ok = () => ({
  content: [{ type: "text" as const, text: "ok" }],
  structuredContent: { ok: true },
})

const json = (data: unknown) => ({
  content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
  structuredContent: data,
})

const text = (data: string) => ({
  content: [{ type: "text" as const, text: data }],
})

export async function createHydraServer(input?: { root?: string }) {
  const root = input?.root ?? process.cwd()
  await HydraCore.init(root)

  const server = new McpServer({
    name: "hydra",
    version: Installation.VERSION,
  })

  server.registerTool(
    "hydra_status",
    {
      description: "获取 Hydra 总体状态",
      inputSchema: z.object({}).strict(),
    },
    async () => json(await HydraCore.getStatus()),
  )

  server.registerTool(
    "hydra_task_list",
    {
      description: "获取任务列表，可按状态过滤",
      inputSchema: z
        .object({
          status: z.enum(taskStatus).optional(),
        })
        .strict(),
    },
    async (args) => {
      const list = await TaskManager.list(root)
      const tasks = args.status ? list.filter((task) => task.meta.status === args.status) : list
      return json(tasks)
    },
  )

  server.registerTool(
    "hydra_task_show",
    {
      description: "获取任务详情",
      inputSchema: z.object({ id: z.string() }).strict(),
    },
    async (args) => {
      const task = await TaskManager.get(root, args.id)
      if (!task) throw new Error(`Task not found: ${args.id}`)
      return json(task)
    },
  )

  server.registerTool(
    "hydra_task_create",
    {
      description: "创建任务",
      inputSchema: z
        .object({
          title: z.string(),
          description: z.string().default(""),
          class: z.string().optional(),
          allow: z.array(z.string()).default([]),
          model: z.string().optional(),
          thinking: z.enum(thinking).optional(),
          timeout: z.number().optional(),
          depends: z.array(z.string()).default([]),
        })
        .strict(),
    },
    async (args) =>
      json(
        await TaskManager.create(root, {
          title: args.title,
          description: args.description,
          agentClass: args.class,
          allow: args.allow,
          model: args.model,
          thinking: args.thinking,
          timeout: args.timeout,
          depends: args.depends,
        }),
      ),
  )

  server.registerTool(
    "hydra_task_cancel",
    {
      description: "取消任务",
      inputSchema: z.object({ id: z.string() }).strict(),
    },
    async (args) => json(await TaskManager.cancel(root, args.id)),
  )

  server.registerTool(
    "hydra_agent_list",
    {
      description: "获取 Agent 列表，可按状态过滤",
      inputSchema: z
        .object({
          status: z.enum(agentStatus).optional(),
        })
        .strict(),
    },
    async (args) => {
      const list = AgentManager.list()
      const agents = args.status ? list.filter((agent) => agent.status === args.status) : list
      return json(agents)
    },
  )

  server.registerTool(
    "hydra_agent_show",
    {
      description: "获取 Agent 详情",
      inputSchema: z.object({ id: z.string() }).strict(),
    },
    async (args) => {
      const agent = AgentManager.get(args.id)
      if (!agent) throw new Error(`Agent not found: ${args.id}`)
      return json(agent)
    },
  )

  server.registerTool(
    "hydra_agent_logs",
    {
      description: "获取 Agent 日志（最近 N 行）",
      inputSchema: z
        .object({
          id: z.string(),
          lines: z.number().int().positive().optional(),
        })
        .strict(),
    },
    async (args) => text(await AgentManager.logs(args.id, { lines: args.lines })),
  )

  server.registerTool(
    "hydra_agent_spawn",
    {
      description: "Spawn 一个 Agent，可选绑定任务",
      inputSchema: z
        .object({
          class: z.string(),
          task: z.string().optional(),
          model: z.string().optional(),
          thinking: z.enum(thinking).optional(),
          prompt: z.string().optional(),
          callback: z
            .object({
              url: z.string().optional(),
              command: z.string().optional(),
              events: z.array(z.enum(callbackEvent)).default(["completed", "failed"]),
              headers: z.record(z.string()).optional(),
            })
            .strict()
            .refine((x) => x.url || x.command, { message: "hydra_agent_spawn: callback requires url or command" })
            .optional(),
        })
        .strict(),
    },
    async (args) => {
      if (args.prompt && !args.task) throw new Error("hydra_agent_spawn: prompt requires task")

      const agent = await AgentManager.spawn(root, {
        class: args.class,
        model: args.model,
        thinking: args.thinking,
        taskId: args.task,
        callback: args.callback,
      })

      if (args.prompt) await AgentManager.send(agent.id, args.prompt, { from: "user" })
      return json(agent)
    },
  )

  server.registerTool(
    "hydra_agent_send",
    {
      description: "给 Agent 发消息",
      inputSchema: z.object({ id: z.string(), message: z.string() }).strict(),
    },
    async (args) => {
      await AgentManager.send(args.id, args.message, { from: "user" })
      return ok()
    },
  )

  server.registerTool(
    "hydra_agent_pause",
    {
      description: "暂停 Agent",
      inputSchema: z.object({ id: z.string() }).strict(),
    },
    async (args) => {
      await AgentManager.pause(args.id)
      return ok()
    },
  )

  server.registerTool(
    "hydra_agent_resume",
    {
      description: "恢复 Agent",
      inputSchema: z.object({ id: z.string() }).strict(),
    },
    async (args) => {
      await AgentManager.resume(args.id)
      return ok()
    },
  )

  server.registerTool(
    "hydra_agent_kill",
    {
      description: "终止 Agent",
      inputSchema: z
        .object({
          id: z.string(),
          cleanup: z.boolean().optional(),
        })
        .strict(),
    },
    async (args) => {
      await AgentManager.kill(args.id, { cleanup: args.cleanup })
      return ok()
    },
  )

  server.registerTool(
    "hydra_start",
    {
      description: "启动自动调度",
      inputSchema: z.object({}).strict(),
    },
    async () => {
      await HydraCore.start()
      return ok()
    },
  )

  server.registerTool(
    "hydra_stop",
    {
      description: "停止自动调度",
      inputSchema: z.object({}).strict(),
    },
    async () => {
      await HydraCore.stop()
      return ok()
    },
  )

  return server
}
