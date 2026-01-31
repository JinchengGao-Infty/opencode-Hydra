import { describe, expect, test } from "bun:test"
import { AgentClass } from "../../src/hydra/agent/class"
import { AgentInstance } from "../../src/hydra/agent/instance"

describe("Hydra AgentInstance", () => {
  test("Info schema parses create() output", () => {
    const inst = AgentInstance.create({
      class: "Coder",
      name: "Coder",
      model: "test/model",
      thinking: AgentClass.Thinking.parse("low"),
      worktree: "/tmp/worktree",
    })

    expect(AgentInstance.Info.parse(inst)).toEqual(inst)
    expect(inst.status).toBe("idle")
    expect(inst.created).toMatch(/Z$/)
  })

  test("generateId() generates unique IDs", () => {
    const set = new Set<string>()
    for (const _ of Array.from({ length: 200 })) set.add(AgentInstance.generateId())
    expect(set.size).toBe(200)
  })
})

