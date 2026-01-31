import { TextareaRenderable } from "@opentui/core"
import { useKeyboard } from "@opentui/solid"
import { createMemo, onCleanup, onMount } from "solid-js"
import { createStore } from "solid-js/store"
import { AgentManager } from "@/hydra/agent/manager"
import { HydraBus, HydraEvent } from "@/hydra/event"
import { TaskManager } from "@/hydra/task/manager"
import { useTheme } from "@tui/context/theme"
import { useToast } from "@tui/ui/toast"
import { AgentTabs } from "./AgentTabs"
import { AgentPanel } from "./AgentPanel"

export function Hydra() {
  const toast = useToast()
  const { theme } = useTheme()

  const [store, setStore] = createStore({
    tab: "main" as "main" | string,
    agents: AgentManager.list(),
    logs: {} as Record<string, string>,
    tasks: {} as Record<string, string>,
  })

  const current = createMemo(() => {
    if (store.tab === "main") return
    return store.agents.find((x) => x.id === store.tab)
  })

  const task = createMemo(() => {
    const agent = current()
    if (!agent?.taskId) return
    return store.tasks[agent.taskId]
  })

  const log = createMemo(() => {
    const agent = current()
    if (!agent) return
    return store.logs[agent.id] ?? ""
  })

  const sync = () => setStore("agents", AgentManager.list())

  const append = (agentId: string, text: string) => {
    const prev = store.logs[agentId] ?? ""
    const next = prev + text
    const limit = 100_000
    const clipped = next.length > limit ? next.slice(next.length - limit) : next
    setStore("logs", agentId, clipped)
  }

  let textarea: TextareaRenderable

  const send = () => {
    const agent = current()
    if (!agent) {
      toast.show({ variant: "warning", message: "Select an agent tab to send messages", duration: 2500 })
      return
    }

    const text = textarea.plainText.trim()
    if (!text) return

    textarea.clear()
    void AgentManager.send(agent.id, text, { from: "user" }).catch(toast.error)
  }

  const pause = () => {
    const agent = current()
    if (!agent) return toast.show({ variant: "warning", message: "Select an agent to pause", duration: 2500 })
    void AgentManager.pause(agent.id).catch(toast.error)
  }

  const resume = () => {
    const agent = current()
    if (!agent) return toast.show({ variant: "warning", message: "Select an agent to resume", duration: 2500 })
    void AgentManager.resume(agent.id).catch(toast.error)
  }

  const kill = () => {
    const agent = current()
    if (!agent) return toast.show({ variant: "warning", message: "Select an agent to kill", duration: 2500 })
    void AgentManager.kill(agent.id).catch(toast.error)
  }

  useKeyboard((evt) => {
    if (evt.name === "tab") {
      const ids = ["main", ...store.agents.map((x) => x.id)]
      const index = Math.max(0, ids.indexOf(store.tab))
      const delta = evt.shift ? -1 : 1
      const next = ids[(index + delta + ids.length) % ids.length]
      if (next) setStore("tab", next)
      evt.preventDefault()
      return
    }

    const ctrlOnly = evt.ctrl && !evt.meta && !evt.shift
    if (!ctrlOnly) return

    if (evt.name === "p") {
      evt.preventDefault()
      pause()
    }

    if (evt.name === "r") {
      evt.preventDefault()
      resume()
    }

    if (evt.name === "k") {
      evt.preventDefault()
      kill()
    }

    const digit = Number(evt.name)
    if (Number.isNaN(digit)) return

    if (digit === 0) {
      evt.preventDefault()
      setStore("tab", "main")
      return
    }

    const agent = store.agents[digit - 1]
    if (!agent) return

    evt.preventDefault()
    setStore("tab", agent.id)
  })

  onMount(() => {
    sync()

    void TaskManager.list(process.cwd())
      .then((list) => {
        setStore(
          "tasks",
          Object.fromEntries(list.map((x) => [x.meta.id, x.title])),
        )
      })
      .catch(() => undefined)

    void Promise.all(
      store.agents.map(async (agent) => {
        const text = await AgentManager.logs(agent.id, { lines: 200 }).catch(() => "")
        if (!text) return
        setStore("logs", agent.id, text)
      }),
    )

    const subs = [
      HydraBus.on(HydraEvent.TaskCreated, (data) => {
        setStore("tasks", data.taskId, data.title)
      }),
      HydraBus.on(HydraEvent.AgentSpawned, () => sync()),
      HydraBus.on(HydraEvent.AgentStarted, () => sync()),
      HydraBus.on(HydraEvent.AgentPaused, () => sync()),
      HydraBus.on(HydraEvent.AgentResumed, () => sync()),
      HydraBus.on(HydraEvent.AgentWaiting, () => sync()),
      HydraBus.on(HydraEvent.AgentCompleted, () => sync()),
      HydraBus.on(HydraEvent.AgentFailed, () => sync()),
      HydraBus.on(HydraEvent.AgentKilled, () => sync()),
      HydraBus.on(HydraEvent.AgentOutput, (data) => append(data.agentId, data.text)),
      HydraBus.on(HydraEvent.AgentMessage, (data) => {
        const from = data.from === "user" ? "You" : "Master"
        append(data.agentId, `${from}: ${data.message}\n`)
      }),
    ]

    setTimeout(() => {
      if (!textarea || textarea.isDestroyed) return
      textarea.focus()
    }, 1)

    onCleanup(() => {
      subs.forEach((fn) => fn())
    })
  })

  return (
    <box width="100%" height="100%" flexDirection="column" backgroundColor={theme.background}>
      <AgentTabs tab={store.tab} agents={store.agents} onSelect={(id) => setStore("tab", id)} />
      <AgentPanel agent={current()} task={task()} log={log()} />
      <box
        flexDirection="row"
        gap={1}
        paddingLeft={2}
        paddingRight={2}
        paddingTop={1}
        paddingBottom={1}
        flexShrink={0}
        backgroundColor={theme.backgroundPanel}
      >
        <text fg={theme.textMuted} flexShrink={0}>
          &gt;
        </text>
        <textarea
          ref={(r: TextareaRenderable) => (textarea = r)}
          placeholder={store.tab === "main" ? "Select an agent tab to send messages…" : "Message agent…"}
          minHeight={1}
          maxHeight={6}
          flexGrow={1}
          textColor={theme.text}
          focusedTextColor={theme.text}
          cursorColor={theme.text}
          onKeyDown={(e) => {
            if (e.name !== "return" || e.shift) return
            e.preventDefault()
            send()
          }}
        />
      </box>
    </box>
  )
}

