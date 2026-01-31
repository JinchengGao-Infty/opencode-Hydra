import { describe, expect, test } from "bun:test"
import fs from "fs/promises"
import path from "node:path"
import { TaskManager } from "../../src/hydra/task/manager"
import { tmpdir } from "../fixture/fixture"

describe("Hydra TaskManager", () => {
  test("init() creates .hydra/tasks directory", async () => {
    await using tmp = await tmpdir()
    await TaskManager.init(tmp.path)

    const dir = path.join(tmp.path, ".hydra/tasks")
    const stat = await fs.stat(dir)
    expect(stat.isDirectory()).toBeTrue()
  })

  test("create() writes file and get() reads it", async () => {
    await using tmp = await tmpdir()

    const task = await TaskManager.create(tmp.path, {
      title: "Example",
      description: "Hello",
    })

    const file = TaskManager.getTaskPath(tmp.path, task.meta.id)
    expect(await Bun.file(file).exists()).toBeTrue()

    const read = await TaskManager.get(tmp.path, task.meta.id)
    expect(read).toEqual(task)
  })

  test("list() returns all tasks and supports status filtering", async () => {
    await using tmp = await tmpdir()

    const a = await TaskManager.create(tmp.path, { title: "A", description: "a" })
    const b = await TaskManager.create(tmp.path, { title: "B", description: "b" })
    await TaskManager.updateStatus(tmp.path, b.meta.id, "done")

    const all = await TaskManager.list(tmp.path)
    expect(all.length).toBe(2)

    const done = await TaskManager.list(tmp.path, { status: ["done"] })
    expect(done.length).toBe(1)
    expect(done[0]?.meta.id).toBe(b.meta.id)

    const pending = await TaskManager.list(tmp.path, { status: ["pending"] })
    expect(pending.length).toBe(1)
    expect(pending[0]?.meta.id).toBe(a.meta.id)
  })

  test("get() returns undefined for missing tasks", async () => {
    await using tmp = await tmpdir()
    expect(await TaskManager.get(tmp.path, "t-missing")).toBeUndefined()
  })

  test("updateStatus() updates status and timestamps", async () => {
    await using tmp = await tmpdir()

    const task = await TaskManager.create(tmp.path, { title: "A", description: "a" })
    const running = await TaskManager.updateStatus(tmp.path, task.meta.id, "running")
    expect(running.meta.status).toBe("running")
    expect(running.meta.started).toMatch(/Z$/)

    const done = await TaskManager.updateStatus(tmp.path, task.meta.id, "done")
    expect(done.meta.status).toBe("done")
    expect(done.meta.finished).toMatch(/Z$/)
  })

  test("updateOutput() updates output and filesChanged", async () => {
    await using tmp = await tmpdir()

    const task = await TaskManager.create(tmp.path, { title: "A", description: "a" })
    const next = await TaskManager.updateOutput(tmp.path, task.meta.id, "ok", ["a.ts", "b.ts"])
    expect(next.output).toBe("ok")
    expect(next.filesChanged).toEqual(["a.ts", "b.ts"])

    const read = await TaskManager.get(tmp.path, task.meta.id)
    expect(read?.output).toBe("ok")
    expect(read?.filesChanged).toEqual(["a.ts", "b.ts"])
  })

  test("cancel() only cancels pending/running tasks", async () => {
    await using tmp = await tmpdir()

    const a = await TaskManager.create(tmp.path, { title: "A", description: "a" })
    const cancelled = await TaskManager.cancel(tmp.path, a.meta.id)
    expect(cancelled.meta.status).toBe("cancelled")

    const b = await TaskManager.create(tmp.path, { title: "B", description: "b" })
    await TaskManager.updateStatus(tmp.path, b.meta.id, "done")
    await expect(TaskManager.cancel(tmp.path, b.meta.id)).rejects.toThrow()
  })

  test("getReady() returns pending tasks with satisfied dependencies", async () => {
    await using tmp = await tmpdir()

    const a = await TaskManager.create(tmp.path, { title: "A", description: "a" })
    const b = await TaskManager.create(tmp.path, { title: "B", description: "b", depends: [a.meta.id] })

    const first = await TaskManager.getReady(tmp.path)
    expect(first.map((x) => x.meta.id)).toContain(a.meta.id)
    expect(first.map((x) => x.meta.id)).not.toContain(b.meta.id)

    await TaskManager.updateStatus(tmp.path, a.meta.id, "done")

    const second = await TaskManager.getReady(tmp.path)
    expect(second.length).toBe(1)
    expect(second[0]?.meta.id).toBe(b.meta.id)
  })
})
