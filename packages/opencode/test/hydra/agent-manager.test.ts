import { describe, expect, test } from "bun:test"
import fs from "fs/promises"
import path from "node:path"
import { AgentManager } from "../../src/hydra/agent/manager"
import { TaskManager } from "../../src/hydra/task/manager"
import { tmpdir } from "../fixture/fixture"

describe("Hydra AgentManager", () => {
  test("spawn() creates a worktree and instance", async () => {
    await using tmp = await tmpdir({ git: true })

    const agent = await AgentManager.spawn(tmp.path, { class: "Coder" })
    expect(agent.status).toBe("idle")
    expect(agent.worktree.length > 0).toBeTrue()

    const stat = await fs.stat(agent.worktree)
    expect(stat.isDirectory()).toBeTrue()

    expect(AgentManager.get(agent.id)).toEqual(agent)
    expect(AgentManager.list().some((x) => x.id === agent.id)).toBeTrue()

    AgentManager.updateStatus(agent.id, "done")
    await AgentManager.kill(agent.id, { cleanup: true })
    await AgentManager.cleanup(agent.id)
  })

  test("start/send/pause/resume/kill/logs work end-to-end", async () => {
    await using tmp = await tmpdir({ git: true })

    const bin = await stub(tmp.path)
    await using _env = await env("HYDRA_OPENCODE_BIN", bin)

    const task = await TaskManager.create(tmp.path, {
      title: "Example",
      description: "Hello",
      allow: ["packages/opencode/src/hydra/**"],
    })

    const agent = await AgentManager.spawn(tmp.path, { class: "Coder", taskId: task.meta.id })
    await AgentManager.start(tmp.path, agent.id)
    expect(AgentManager.get(agent.id)?.pid).toBeNumber()

    await AgentManager.send(agent.id, "wait")
    await wait(agent.id, "waiting")

    await AgentManager.send(agent.id, "hello")
    await wait(agent.id, "running")

    await AgentManager.pause(agent.id)
    await wait(agent.id, "paused")

    await AgentManager.resume(agent.id)
    await wait(agent.id, "running")

    await AgentManager.send(agent.id, "done")
    await wait(agent.id, "done")

    const log = await AgentManager.logs(agent.id)
    expect(log).toContain("READY")
    expect(log).toContain("WAITING")
    expect(log).toContain("DONE")

    await AgentManager.kill(agent.id, { cleanup: true })
    await AgentManager.cleanup(agent.id)
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

async function wait(agentId: string, status: string) {
  for (const _ of Array.from({ length: 200 })) {
    if (AgentManager.get(agentId)?.status === status) return
    await Bun.sleep(10)
  }

  expect(AgentManager.get(agentId)?.status).toBe(status)
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
