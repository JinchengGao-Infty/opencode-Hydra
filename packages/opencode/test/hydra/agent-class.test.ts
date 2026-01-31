import { describe, expect, test } from "bun:test"
import fs from "fs/promises"
import path from "node:path"
import { AgentClass } from "../../src/hydra/agent/class"
import { tmpdir } from "../fixture/fixture"

describe("Hydra AgentClass", () => {
  test("BUILTIN definitions are valid and complete", () => {
    expect(Object.keys(AgentClass.BUILTIN).sort()).toEqual(["Architect", "Coder", "Reviewer", "Writer"])

    for (const key of Object.keys(AgentClass.BUILTIN)) {
      const info = AgentClass.BUILTIN[key]
      expect(AgentClass.Info.parse(info)).toEqual(info)
      expect(info.prompt.length > 0).toBeTrue()
    }
  })

  test("loadCustom() returns empty when config is missing", async () => {
    await using tmp = await tmpdir()
    expect(await AgentClass.loadCustom(tmp.path)).toEqual({})
  })

  test("loadCustom() parses .hydra/agents.yaml", async () => {
    await using tmp = await tmpdir()

    const dir = path.join(tmp.path, ".hydra")
    await fs.mkdir(dir, { recursive: true })

    const file = path.join(dir, "agents.yaml")
    await Bun.write(
      file,
      [
        "classes:",
        "  CustomAgent:",
        '    description: "自定义 Agent 描述"',
        "    prompt: |",
        "      你是一个自定义 Agent...",
        "    defaultModel: openai/gpt-5",
        "    defaultThinking: high",
        "",
        "  AnotherAgent:",
        '    description: "另一个自定义 Agent"',
        "    prompt: |",
        "      ...",
        "    defaultModel: anthropic/claude-sonnet",
        "    defaultThinking: medium",
        "",
      ].join("\n"),
    )

    const custom = await AgentClass.loadCustom(tmp.path)
    expect(Object.keys(custom).sort()).toEqual(["AnotherAgent", "CustomAgent"])
    expect(custom.CustomAgent?.defaultThinking).toBe("high")
    expect(custom.AnotherAgent?.defaultModel).toBe("anthropic/claude-sonnet")
  })

  test("get() prefers custom over builtin", async () => {
    await using tmp = await tmpdir()

    const dir = path.join(tmp.path, ".hydra")
    await fs.mkdir(dir, { recursive: true })

    const file = path.join(dir, "agents.yaml")
    await Bun.write(
      file,
      [
        "classes:",
        "  Coder:",
        '    description: "覆盖内置 Coder"',
        "    prompt: |",
        "      custom coder",
        "    defaultModel: openai/gpt-5",
        "    defaultThinking: low",
        "",
      ].join("\n"),
    )

    const info = await AgentClass.get(tmp.path, "Coder")
    expect(info?.description).toBe("覆盖内置 Coder")
    expect(info?.defaultThinking).toBe("low")
  })

  test("list() returns merged classes with overrides applied", async () => {
    await using tmp = await tmpdir()

    const dir = path.join(tmp.path, ".hydra")
    await fs.mkdir(dir, { recursive: true })

    const file = path.join(dir, "agents.yaml")
    await Bun.write(
      file,
      [
        "classes:",
        "  Coder:",
        '    description: "覆盖内置 Coder"',
        "    prompt: |",
        "      custom coder",
        "    defaultModel: openai/gpt-5",
        "    defaultThinking: low",
        "",
        "  Extra:",
        '    description: "额外的类"',
        "    prompt: |",
        "      extra",
        "    defaultModel: anthropic/claude-sonnet",
        "    defaultThinking: medium",
        "",
      ].join("\n"),
    )

    const list = await AgentClass.list(tmp.path)
    expect(list.length).toBe(5)

    const coder = list.find((x) => x.name === "Coder")
    expect(coder?.description).toBe("覆盖内置 Coder")

    const names = list.map((x) => x.name).sort()
    expect(names).toEqual(["Architect", "Coder", "Extra", "Reviewer", "Writer"])
  })

  test("exists() returns true for builtin and custom classes", async () => {
    await using tmp = await tmpdir()

    expect(await AgentClass.exists(tmp.path, "Coder")).toBeTrue()
    expect(await AgentClass.exists(tmp.path, "Missing")).toBeFalse()

    const dir = path.join(tmp.path, ".hydra")
    await fs.mkdir(dir, { recursive: true })

    const file = path.join(dir, "agents.yaml")
    await Bun.write(
      file,
      [
        "classes:",
        "  Custom:",
        '    description: "自定义"',
        "    prompt: |",
        "      ok",
        "    defaultModel: openai/gpt-5",
        "    defaultThinking: high",
        "",
      ].join("\n"),
    )

    expect(await AgentClass.exists(tmp.path, "Custom")).toBeTrue()
  })
})
