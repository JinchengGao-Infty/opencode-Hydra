import { describe, expect, test } from "bun:test"
import { Task } from "../../src/hydra/task/task"
import { TaskParser } from "../../src/hydra/task/parser"
import { tmpdir } from "../fixture/fixture"

describe("Hydra Task", () => {
  test("Task.generateId() generates unique IDs", () => {
    const set = new Set<string>()
    for (const _ of Array.from({ length: 200 })) set.add(Task.generateId())
    expect(set.size).toBe(200)
  })

  test("Task.create() creates a valid task", () => {
    const task = Task.create({
      title: "Example",
      description: "Hello",
      allow: ["src/**"],
      depends: ["t000"],
      timeout: 60,
      thinking: "medium",
    })

    expect(task.meta.id.startsWith("t")).toBeTrue()
    expect(task.meta.status).toBe("pending")
    expect(task.meta.allow).toEqual(["src/**"])
    expect(task.meta.depends).toEqual(["t000"])
    expect(task.meta.timeout).toBe(60)
    expect(task.meta.thinking).toBe("medium")
    expect(task.meta.created).toMatch(/Z$/)
  })

  test("TaskParser.parse() parses the example format", () => {
    const md = `# Task: 任务标题

## Meta
- id: t001
- status: pending
- agentClass: Coder
- model: anthropic/claude-sonnet
- thinking: high
- allow: src/**, tests/**
- timeout: 3600
- depends: t000, t002
- created: 2026-01-31T18:00:00Z
- started: 2026-01-31T18:01:00Z
- finished: 2026-01-31T18:10:00Z

## Description
任务描述...

## Output
（完成后填写）

## Files Changed
- file1.ts (新建)
- file2.ts (修改)
`

    const task = TaskParser.parse(md)

    expect(task.title).toBe("任务标题")
    expect(task.meta.id).toBe("t001")
    expect(task.meta.status).toBe("pending")
    expect(task.meta.agentClass).toBe("Coder")
    expect(task.meta.model).toBe("anthropic/claude-sonnet")
    expect(task.meta.thinking).toBe("high")
    expect(task.meta.allow).toEqual(["src/**", "tests/**"])
    expect(task.meta.timeout).toBe(3600)
    expect(task.meta.depends).toEqual(["t000", "t002"])
    expect(task.meta.created).toBe("2026-01-31T18:00:00Z")
    expect(task.meta.started).toBe("2026-01-31T18:01:00Z")
    expect(task.meta.finished).toBe("2026-01-31T18:10:00Z")
    expect(task.description).toBe("任务描述...")
    expect(task.output).toBe("（完成后填写）")
    expect(task.filesChanged).toEqual(["file1.ts (新建)", "file2.ts (修改)"])
  })

  test("TaskParser.serialize() roundtrips with parse()", () => {
    const task = Task.create({
      title: "Roundtrip",
      description: "Some description",
      agentClass: "Coder",
      model: "openai/gpt-4.1-mini",
      allow: ["src/**", "test/**"],
      depends: [],
      timeout: 120,
    })

    const md = TaskParser.serialize(task)
    const parsed = TaskParser.parse(md)
    expect(parsed).toEqual(task)
  })

  test("TaskParser.readFile()/writeFile() roundtrip", async () => {
    await using tmp = await tmpdir()
    const path = tmp.path + "/task.md"
    const task = Task.create({
      title: "File",
      description: "From disk",
      allow: [],
      depends: ["t123"],
    })

    await TaskParser.writeFile(path, task)
    const read = await TaskParser.readFile(path)
    expect(read).toEqual(task)
  })
})
