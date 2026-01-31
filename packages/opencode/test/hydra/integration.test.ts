import { afterEach, describe, expect, test } from "bun:test"
import fs from "fs/promises"
import path from "node:path"
import { AgentManager } from "../../src/hydra/agent/manager"
import { HydraCore } from "../../src/hydra/core"
import { HydraBus, HydraEvent } from "../../src/hydra/event"
import { TaskManager } from "../../src/hydra/task/manager"
import { tmpdir } from "../fixture/fixture"

describe("Hydra Integration", () => {
  afterEach(async () => {
    await HydraCore.reset()
    HydraBus.clearHistory()

    for (const agent of AgentManager.list()) {
      await AgentManager.kill(agent.id, { cleanup: true }).catch(() => undefined)
      await AgentManager.cleanup(agent.id)
    }
  })

  test("runs end-to-end workflow with events + waiting + completion", async () => {
    HydraBus.clearHistory()
    await using tmp = await tmpdir({ git: true })

    const bin = await stub(tmp.path)
    await using _env = await env("HYDRA_OPENCODE_BIN", bin)

    await HydraCore.init(tmp.path, { maxAgents: 1, pollInterval: 10, defaultTimeout: 2 })
    await HydraCore.start()

    const created = HydraBus.once(HydraEvent.TaskCreated, undefined, 3000)
    const started = HydraBus.once(HydraEvent.TaskStarted, undefined, 3000)
    const waiting = HydraBus.once(HydraEvent.AgentWaiting, undefined, 3000)
    const completed = HydraBus.once(HydraEvent.TaskCompleted, undefined, 5000)

    const task = await HydraCore.runTask({
      title: "Integration",
      description: "E2E workflow",
      allow: ["packages/opencode/src/hydra/**"],
    })

    expect((await created).taskId).toBe(task.meta.id)
    const start = await started
    expect(start.taskId).toBe(task.meta.id)

    await AgentManager.send(start.agentId, "wait")
    const wait = await waiting
    expect(wait.agentId).toBe(start.agentId)
    expect(wait.taskId).toBe(task.meta.id)

    await AgentManager.send(start.agentId, "done")
    const done = await completed
    expect(done.taskId).toBe(task.meta.id)
    expect(done.agentId).toBe(start.agentId)
    expect(done.output).toBe("完成任务")
    expect(done.filesChanged).toEqual(["src/a.ts", "src/b.ts"])

    const saved = await TaskManager.get(tmp.path, task.meta.id)
    expect(saved?.meta.status).toBe("done")
    expect(saved?.output).toBe("完成任务")
    expect(saved?.filesChanged).toEqual(["src/a.ts", "src/b.ts"])
  })
})

async function stub(dir: string) {
  const file = path.join(dir, "opencode-stub")
  await Bun.write(
    file,
    [
      "#!/usr/bin/env bash",
      "set -euo pipefail",
      "echo READY",
      'while IFS= read -r line; do',
      '  if [[ \"$line\" == \"wait\" ]]; then',
      "    echo WAITING",
      "    continue",
      "  fi",
      '  if [[ \"$line\" == \"done\" ]]; then',
      "    echo DONE",
      "    echo",
      "    echo \"✅ 完成\"",
      "    echo",
      '    echo \"**总结**: 完成任务\"',
      "    echo",
      '    echo \"**修改的文件**:\"',
      '    echo \"- src/a.ts\"',
      '    echo \"- src/b.ts\"',
      "    echo",
      "    exit 0",
      "  fi",
      '  if [[ \"$line\" == \"fail\" ]]; then',
      "    echo FAILED",
      "    exit 1",
      "  fi",
      "  echo \"ECHO: $line\"",
      "done",
      "exit 0",
      "",
    ].join("\n"),
  )
  await fs.chmod(file, 0o755)
  return file
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
