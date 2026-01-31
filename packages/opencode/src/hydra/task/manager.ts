import fs from "fs/promises"
import path from "node:path"
import { Task } from "./task"
import { TaskParser } from "./parser"

export namespace TaskManager {
  const TASKS_DIR = ".hydra/tasks"

  export async function init(projectRoot: string): Promise<void> {
    await fs.mkdir(path.join(projectRoot, TASKS_DIR), { recursive: true })
  }

  export function getTaskPath(projectRoot: string, id: string): string {
    return path.join(projectRoot, TASKS_DIR, `${id}.md`)
  }

  export async function create(
    projectRoot: string,
    input: {
      title: string
      description: string
      agentClass?: string
      model?: string
      thinking?: "low" | "medium" | "high"
      allow?: string[]
      timeout?: number
      depends?: string[]
    },
  ): Promise<Task.Info> {
    await init(projectRoot)
    const task = Task.create(input)
    await TaskParser.writeFile(getTaskPath(projectRoot, task.meta.id), task)
    return task
  }

  export async function list(
    projectRoot: string,
    filter?: {
      status?: Task.Status[]
    },
  ): Promise<Task.Info[]> {
    const files = await listTaskFiles(projectRoot)
    const tasks = await Promise.all(files.map((x) => TaskParser.readFile(x)))
    if (!filter?.status?.length) return tasks
    return tasks.filter((x) => filter.status?.includes(x.meta.status))
  }

  export async function get(projectRoot: string, id: string): Promise<Task.Info | undefined> {
    await init(projectRoot)
    const file = getTaskPath(projectRoot, id)
    const ok = await Bun.file(file).exists()
    if (!ok) return
    return TaskParser.readFile(file)
  }

  export async function updateStatus(projectRoot: string, id: string, status: Task.Status): Promise<Task.Info> {
    const task = await get(projectRoot, id)
    if (!task) throw new Error(`TaskManager.updateStatus: task not found: ${id}`)

    const now = new Date().toISOString()
    const started = status === "running" && !task.meta.started ? now : task.meta.started
    const finished = (status === "done" || status === "failed") && !task.meta.finished ? now : task.meta.finished

    const next = Task.Info.parse({
      ...task,
      meta: {
        ...task.meta,
        status,
        started,
        finished,
      },
    })

    await TaskParser.writeFile(getTaskPath(projectRoot, id), next)
    return next
  }

  export async function updateOutput(
    projectRoot: string,
    id: string,
    output: string,
    filesChanged?: string[],
  ): Promise<Task.Info> {
    const task = await get(projectRoot, id)
    if (!task) throw new Error(`TaskManager.updateOutput: task not found: ${id}`)

    const next = Task.Info.parse({
      ...task,
      output,
      filesChanged: filesChanged === undefined ? task.filesChanged : filesChanged,
    })

    await TaskParser.writeFile(getTaskPath(projectRoot, id), next)
    return next
  }

  export async function cancel(projectRoot: string, id: string): Promise<Task.Info> {
    const task = await get(projectRoot, id)
    if (!task) throw new Error(`TaskManager.cancel: task not found: ${id}`)

    const ok = task.meta.status === "pending" || task.meta.status === "running"
    if (!ok) throw new Error(`TaskManager.cancel: task not cancellable: ${id}`)

    const next = Task.Info.parse({
      ...task,
      meta: {
        ...task.meta,
        status: "cancelled",
      },
    })

    await TaskParser.writeFile(getTaskPath(projectRoot, id), next)
    return next
  }

  export async function getReady(projectRoot: string): Promise<Task.Info[]> {
    const tasks = await list(projectRoot)
    const ready = await Promise.all(
      tasks.map(async (task) => {
        if (task.meta.status !== "pending") return
        const ok = await checkDependencies(projectRoot, task.meta.depends)
        if (!ok) return
        return task
      }),
    )
    return ready.filter((x): x is Task.Info => Boolean(x))
  }
}

async function checkDependencies(projectRoot: string, depends: string[]): Promise<boolean> {
  if (!depends.length) return true
  const list = await Promise.all(depends.map((x) => TaskManager.get(projectRoot, x)))
  return list.every((x) => x?.meta.status === "done")
}

async function listTaskFiles(projectRoot: string): Promise<string[]> {
  await TaskManager.init(projectRoot)
  const dir = path.join(projectRoot, ".hydra/tasks")
  const list = await fs.readdir(dir, { withFileTypes: true })
  const files = list
    .filter((x) => x.isFile() && x.name.endsWith(".md"))
    .map((x) => path.join(dir, x.name))
  files.sort()
  return files
}
