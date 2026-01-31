import { afterEach, describe, expect, test } from "bun:test"
import fs from "fs/promises"
import path from "node:path"
import { AgentManager } from "../../src/hydra/agent/manager"
import { HydraCore } from "../../src/hydra/core"
import { TaskManager } from "../../src/hydra/task/manager"
import { tmpdir } from "../fixture/fixture"

describe("HydraCore", () => {
  afterEach(async () => {
    await HydraCore.reset()
  })

  test("runTask() assigns and completes without start()", async () => {
    await using tmp = await tmpdir({ git: true })

    const bin = await stub(tmp.path)
    await using _env = await env("HYDRA_OPENCODE_BIN", bin)

    await HydraCore.init(tmp.path, { maxAgents: 1, pollInterval: 10, defaultTimeout: 1 })

    const task = await HydraCore.runTask({
      title: "Example",
      description: "Hello",
      allow: ["packages/opencode/src/hydra/**"],
    })

    const result = await HydraCore.waitForTask(task.meta.id, 2000)
    expect(result.meta.status).toBe("done")
    expect(result.output).toBe("完成任务")
    expect(result.filesChanged).toEqual(["src/a.ts", "src/b.ts"])
  })

  test("start() schedules pending tasks and respects dependencies", async () => {
    await using tmp = await tmpdir({ git: true })

    const bin = await stub(tmp.path, { sleep: 0.15 })
    await using _env = await env("HYDRA_OPENCODE_BIN", bin)

    const a = await TaskManager.create(tmp.path, {
      title: "A",
      description: "a",
      allow: ["packages/opencode/src/hydra/**"],
    })

    const b = await TaskManager.create(tmp.path, {
      title: "B",
      description: "b",
      allow: ["packages/opencode/src/hydra/**"],
      depends: [a.meta.id],
    })

    await HydraCore.init(tmp.path, { maxAgents: 3, pollInterval: 10, defaultTimeout: 2 })
    await HydraCore.start()

    await wait(async () => {
      const task = await TaskManager.get(tmp.path, a.meta.id)
      return task?.meta.status === "running"
    })

    const pending = await TaskManager.get(tmp.path, b.meta.id)
    expect(pending?.meta.status).toBe("pending")

    const doneA = await HydraCore.waitForTask(a.meta.id, 5000)
    expect(doneA.meta.status).toBe("done")

    const doneB = await HydraCore.waitForTask(b.meta.id, 5000)
    expect(doneB.meta.status).toBe("done")

    await wait(() => AgentManager.list().length === 0)
  })
})

async function stub(dir: string, input?: { sleep?: number }) {
  const file = path.join(dir, "opencode-stub")
  const delay = input?.sleep

  const script = [
    "#!/usr/bin/env bash",
    "set -euo pipefail",
    "echo READY",
    delay ? `sleep ${delay}` : "",
    'echo "✅ 完成"',
    "echo",
    'echo "**总结**: 完成任务"',
    "echo",
    'echo "**修改的文件**:"',
    'echo "- src/a.ts"',
    'echo "- src/b.ts"',
    "echo",
    "exit 0",
    "",
  ]
    .filter((x) => x !== "")
    .join("\n")

  await Bun.write(file, script)
  await fs.chmod(file, 0o755)
  return file
}

async function wait(check: (() => boolean) | (() => Promise<boolean>), options?: { timeout?: number }) {
  const timeout = options?.timeout ?? 5000
  const start = Date.now()

  for (const _ of Array.from({ length: 500 })) {
    const ok = await check()
    if (ok) return
    if (Date.now() - start > timeout) break
    await Bun.sleep(10)
  }

  expect(await check()).toBeTrue()
}

async function env(key: string, val: string) {
  const prev = process.env[key]
  process.env[key] = val

  const restore = async () => {
    if (prev === undefined) delete process.env[key]
    if (prev !== undefined) process.env[key] = prev
  }

  return {
    [Symbol.asyncDispose]: restore,
  }
}
