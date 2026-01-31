import { Task } from "./task"

export namespace TaskParser {
  export function parse(content: string): Task.Info {
    const text = content.replace(/\r\n/g, "\n")
    const lines = text.split("\n")

    const head = lines.find((x) => x.trimStart().startsWith("# "))
    if (!head) throw new Error("TaskParser.parse: missing title")

    const raw = head.replace(/^#\s*/, "").trim()
    const title = raw.startsWith("Task:") ? raw.slice("Task:".length).trim() : raw

    const block = (name: string) => {
      const start = lines.findIndex((x) => x.trim() === `## ${name}`)
      if (start === -1) return

      const end = lines.findIndex((x, i) => i > start && x.trimStart().startsWith("## "))
      const stop = end === -1 ? lines.length : end

      return lines.slice(start + 1, stop)
    }

    const metaLines = block("Meta")
    if (!metaLines) throw new Error("TaskParser.parse: missing Meta section")

    const meta: Record<string, unknown> = {}
    for (const line of metaLines) {
      const match = line.match(/^\s*-\s*([^:]+):\s*(.*)$/)
      if (!match) continue

      const key = match[1]?.trim()
      if (!key) continue

      const val = match[2]?.trim() ?? ""

      if (key === "allow" || key === "depends") {
        meta[key] = val
          .split(",")
          .map((x) => x.trim())
          .filter(Boolean)
        continue
      }

      if (key === "timeout") {
        if (!val) continue
        const num = Number(val)
        if (!Number.isFinite(num)) throw new Error(`TaskParser.parse: invalid timeout: ${val}`)
        meta.timeout = num
        continue
      }

      if (!val) continue
      meta[key] = val
    }

    const descLines = block("Description")
    if (!descLines) throw new Error("TaskParser.parse: missing Description section")

    const description = descLines.join("\n").trim()
    const output = block("Output")?.join("\n").trim()
    const changed = block("Files Changed")
      ?.map((x) => x.match(/^\s*-\s+(.*)$/)?.[1]?.trim() ?? "")
      .filter(Boolean)

    return Task.Info.parse({
      meta,
      title,
      description,
      output: output ? output : undefined,
      filesChanged: changed && changed.length ? changed : undefined,
    })
  }

  export function serialize(task: Task.Info): string {
    const info = Task.Info.parse(task)

    const lines: string[] = []
    lines.push(`# Task: ${info.title}`)
    lines.push("")
    lines.push("## Meta")
    lines.push(`- id: ${info.meta.id}`)
    lines.push(`- status: ${info.meta.status}`)
    if (info.meta.agentClass) lines.push(`- agentClass: ${info.meta.agentClass}`)
    if (info.meta.model) lines.push(`- model: ${info.meta.model}`)
    if (info.meta.thinking) lines.push(`- thinking: ${info.meta.thinking}`)
    lines.push(`- allow: ${info.meta.allow.join(", ")}`)
    if (info.meta.timeout !== undefined) lines.push(`- timeout: ${info.meta.timeout}`)
    lines.push(`- depends: ${info.meta.depends.join(", ")}`)
    lines.push(`- created: ${info.meta.created}`)
    if (info.meta.started) lines.push(`- started: ${info.meta.started}`)
    if (info.meta.finished) lines.push(`- finished: ${info.meta.finished}`)
    lines.push("")
    lines.push("## Description")
    lines.push(info.description.trim())
    lines.push("")
    lines.push("## Output")
    if (info.output) lines.push(info.output.trim())
    lines.push("")
    lines.push("## Files Changed")
    if (info.filesChanged?.length) {
      for (const file of info.filesChanged) lines.push(`- ${file}`)
    }

    return lines.join("\n").trimEnd() + "\n"
  }

  export async function readFile(path: string): Promise<Task.Info> {
    const content = await Bun.file(path).text()
    return parse(content)
  }

  export async function writeFile(path: string, task: Task.Info): Promise<void> {
    await Bun.write(path, serialize(task))
  }
}

