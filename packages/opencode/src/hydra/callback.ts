import { $ } from "bun"

export namespace CallbackManager {
  export type Event = "completed" | "failed" | "waiting"

  export type Config = {
    url?: string
    command?: string
    events?: Event[]
    headers?: Record<string, string>
  }

  type Callback = {
    agentId: string
    url?: string
    command?: string
    events: Event[]
    headers?: Record<string, string>
  }

  const callbacks = new Map<string, Callback>()

  export function register(agentId: string, config: Config): void {
    const events = config.events?.length ? config.events : (["completed", "failed"] satisfies Event[])

    callbacks.set(agentId, {
      agentId,
      url: config.url,
      command: config.command,
      events,
      headers: config.headers,
    })
  }

  export function unregister(agentId: string): void {
    callbacks.delete(agentId)
  }

  export async function notify(event: Event, data: { agentId: string; taskId?: string } & Record<string, unknown>): Promise<void> {
    const cb = callbacks.get(data.agentId)
    if (!cb) return
    if (!cb.events.includes(event)) return

    const timestamp = new Date().toISOString()
    const { agentId, taskId, ...rest } = data
    const payload = {
      event: `agent.${event}`,
      agentId,
      taskId,
      timestamp,
      data: rest,
    }

    if (cb.url) await notifyHttp(cb.url, cb.headers ?? {}, payload)
    if (cb.command) await notifyCommand(cb.command, { ...data, event, agentId, taskId: taskId ?? "", timestamp })
  }
}

async function notifyHttp(url: string, headers: Record<string, string>, payload: unknown) {
  await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...headers,
    },
    body: JSON.stringify(payload),
  }).catch(() => undefined)
}

async function notifyCommand(command: string, data: Record<string, unknown>) {
  const vars: Record<string, string> = {
    agentId: value(data, "agentId"),
    taskId: value(data, "taskId"),
    event: value(data, "event"),
    timestamp: value(data, "timestamp"),
    reason: value(data, "reason"),
    error: value(data, "error"),
    output: value(data, "output"),
    filesChanged: json(data, "filesChanged"),
  }

  const cmd = Object.entries(vars).reduce((text, entry) => text.replaceAll(`{${entry[0]}}`, entry[1]), command)
  await $`sh -c ${cmd}`.quiet().nothrow()
}

function value(data: Record<string, unknown>, key: string): string {
  const val = data[key]
  if (typeof val === "string") return val
  return ""
}

function json(data: Record<string, unknown>, key: string): string {
  const val = data[key]
  if (val === undefined) return ""
  return JSON.stringify(val)
}
