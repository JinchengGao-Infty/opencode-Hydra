import { UI } from "../../cli/ui"
import { AgentManager } from "../agent/manager"
import { TaskManager } from "../task/manager"
import { Format } from "./format"

export namespace StatusCommand {
  export async function handler() {
    const root = process.cwd()
    const tasks = await TaskManager.list(root).catch((err) => {
      fail(err)
      return
    })
    if (!tasks) return

    const agents = AgentManager.list()
    process.stdout.write(Format.statusSummary(tasks, agents))
  }
}

function fail(err: unknown) {
  UI.error(err instanceof Error ? err.message : String(err))
  process.exitCode = 1
}

