import { describe, expect, test } from "bun:test"
import fs from "fs/promises"
import path from "node:path"
import { AgentLogger } from "../../src/hydra/agent/logger"
import { tmpdir } from "../fixture/fixture"

describe("Hydra AgentLogger", () => {
  test("create() does not create the log file until first write", async () => {
    await using tmp = await tmpdir()

    const logger = AgentLogger.create({
      agentId: "agent-abc123",
      class: "Coder",
      model: "openai/gpt-5",
      thinking: "high",
      taskId: "t001",
      taskTitle: "Demo",
      worktree: tmp.path,
      started: "2026-01-31 18:00:00",
    })

    expect(logger.path()).toBe(path.join(tmp.path, ".hydra", "agent-log.md"))
    expect(await logger.read()).toBe("")
    expect(await Bun.file(logger.path()).exists()).toBeFalse()
  })

  test("writes header and timeline entries", async () => {
    await using tmp = await tmpdir()

    const logger = AgentLogger.create({
      agentId: "agent-abc123",
      class: "Coder",
      model: "openai/gpt-5",
      thinking: "high",
      taskId: "t001",
      taskTitle: "Demo",
      worktree: tmp.path,
      started: "2026-01-31 18:00:00",
    })

    await logger.info("开始分析任务")
    await logger.warn("需要确认")
    await logger.error("发生错误")
    await logger.success("阶段完成")
    await logger.log("info", "探索代码库", { files_found: ["src/auth/index.ts"], framework: "React" })
    await logger.waiting("不确定应该用 JWT 还是 Session 进行认证。")
    await logger.received("使用 JWT，不要用 Session")
    await logger.complete("实现了日志系统，并补齐单元测试。", ["src/hydra/agent/logger.ts", "test/hydra/agent-logger.test.ts"])

    const content = await Bun.file(logger.path()).text()

    expect(content).toContain("# Agent Log: agent-abc123")
    expect(content).toContain("## Session Info")
    expect(content).toContain("- ID: agent-abc123")
    expect(content).toContain("- Class: Coder")
    expect(content).toContain("- Model: openai/gpt-5")
    expect(content).toContain("- Thinking: high")
    expect(content).toContain("- Task: t001 - Demo")
    expect(content).toContain(`- Worktree: ${tmp.path}`)
    expect(content).toContain("- Started: 2026-01-31 18:00:00")
    expect(content).toContain("## Timeline")

    expect(content).toMatch(/### \d{2}:\d{2}:\d{2} - 开始分析任务/)
    expect(content).toContain("### ")
    expect(content).toContain("⚠️ 需要确认")
    expect(content).toContain("❌ 发生错误")
    expect(content).toContain("✅ 阶段完成")

    expect(content).toContain("```json")
    expect(content).toContain('"framework": "React"')

    expect(content).toContain("⚠️ 等待输入")
    expect(content).toContain("**状态**: 等待主控指示")

    expect(content).toContain("### ")
    expect(content).toContain("收到消息")
    expect(content).toContain("> 使用 JWT，不要用 Session")

    expect(content).toContain("✅ 完成")
    expect(content).toContain("**总结**:")
    expect(content).toContain("**修改的文件**:")
    expect(content).toContain("- src/hydra/agent/logger.ts")
  })

  test("read({ lines }) returns last N lines", async () => {
    await using tmp = await tmpdir()

    const logger = AgentLogger.create({
      agentId: "agent-abc123",
      class: "Coder",
      model: "openai/gpt-5",
      thinking: "high",
      worktree: tmp.path,
      started: "2026-01-31 18:00:00",
    })

    await fs.mkdir(path.dirname(logger.path()), { recursive: true })
    await Bun.write(logger.path(), ["l1", "l2", "l3", "l4"].join("\n"))

    expect(await logger.read({ lines: 2 })).toBe(["l3", "l4"].join("\n"))
  })
})
