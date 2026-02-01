import { TextareaRenderable } from "@opentui/core"
import { useKeyboard } from "@opentui/solid"
import { createEffect, createMemo, createSignal, on, onCleanup, onMount } from "solid-js"
import { createStore } from "solid-js/store"
import { AgentInstance } from "@/hydra/agent"
import { Task } from "@/hydra/task"
import { useSDK } from "@tui/context/sdk"
import { useTheme } from "@tui/context/theme"
import { useToast } from "@tui/ui/toast"
import { AgentTabs } from "./AgentTabs"
import { AgentPanel } from "./AgentPanel"

export function Hydra() {
  const sdk = useSDK()
  const toast = useToast()
  const { theme } = useTheme()

  const [store, setStore] = createStore({
    tab: "main" as "main" | string,
    agents: [] as AgentInstance.Info[],
    logs: {} as Record<string, string>,
    tasks: {} as Record<string, string>,
    hidden: {} as Record<string, true>,
  })

  const viewAgents = createMemo(() => store.agents.filter((x) => !store.hidden[x.id]))

  const current = createMemo(() => {
    if (store.tab === "main") return
    return viewAgents().find((x) => x.id === store.tab)
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

  const clip = (text: string) => {
    const limit = 500_000
    if (text.length <= limit) return text
    return text.slice(text.length - limit)
  }

  const load = async (id: string) => {
    const text = await sdk.client.hydra.agent
      .logs({ id, lines: 2000 })
      .then((x) => x.data?.text ?? "")
      .catch(() => "")
    if (!text) return
    setStore("logs", id, clip(text))
  }

  const sync = () => {
    const a = sdk.client.hydra.agent
      .list()
      .then((x) => AgentInstance.Info.array().parse(x.data?.agents ?? []))
      .then((agents) => {
        setStore("agents", agents)
        if (store.tab === "main") return
        if (agents.some((x) => x.id === store.tab)) return
        setStore("tab", "main")
      })

    const t = sdk.client.hydra.task
      .list()
      .then((x) => Task.Info.array().parse(x.data?.tasks ?? []))
      .then((tasks) => setStore("tasks", Object.fromEntries(tasks.map((x) => [x.meta.id, x.title]))))

    return Promise.all([a, t]).then(() => {
      const agent = current()
      if (!agent) return
      return load(agent.id)
    })
  }

  const [area, setArea] = createSignal<TextareaRenderable>()

  const send = () => {
    const agent = current()
    if (!agent) {
      toast.show({ variant: "warning", message: "Select an agent tab to send messages", duration: 2500 })
      return
    }

    const textarea = area()
    if (!textarea) return

    const text = textarea.plainText.trim()
    if (!text) return

    textarea.clear()
    void sdk.client.hydra.agent
      .send({ id: agent.id, message: text })
      .then(() => load(agent.id))
      .catch(toast.error)
  }

  const pause = () => {
    const agent = current()
    if (!agent) return toast.show({ variant: "warning", message: "Select an agent to pause", duration: 2500 })
    void sdk.client.hydra.agent.pause({ id: agent.id }).then(sync).catch(toast.error)
  }

  const resume = () => {
    const agent = current()
    if (!agent) return toast.show({ variant: "warning", message: "Select an agent to resume", duration: 2500 })
    void sdk.client.hydra.agent.resume({ id: agent.id }).then(sync).catch(toast.error)
  }

  const kill = () => {
    const agent = current()
    if (!agent) return toast.show({ variant: "warning", message: "Select an agent to kill", duration: 2500 })
    void sdk.client.hydra.agent.kill({ id: agent.id, cleanup: false }).then(sync).catch(toast.error)
  }

  const close = (id?: string) => {
    const tab = id ?? store.tab
    if (!tab || tab === "main") return
    setStore("hidden", tab, true)
    if (store.tab === tab) setStore("tab", "main")
  }

  useKeyboard((evt) => {
    if (evt.name === "tab") {
      const ids = ["main", ...viewAgents().map((x) => x.id)]
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

    if (evt.name === "w") {
      evt.preventDefault()
      close()
    }

    const digit = Number(evt.name)
    if (Number.isNaN(digit)) return

    if (digit === 0) {
      evt.preventDefault()
      setStore("tab", "main")
      return
    }

    const agent = viewAgents()[digit - 1]
    if (!agent) return

    evt.preventDefault()
    setStore("tab", agent.id)
  })

  onMount(() => {
    void sync().catch(toast.error)

    const id = setInterval(() => {
      void sync().catch(() => undefined)
    }, 500)

    createEffect(
      on(
        () => store.tab,
        () => {
          const agent = current()
          if (!agent) return
          void load(agent.id).catch(() => undefined)
        },
      ),
    )

    setTimeout(() => {
      const textarea = area()
      if (!textarea || textarea.isDestroyed) return
      textarea.focus()
    }, 1)

    onCleanup(() => {
      clearInterval(id)
    })
  })

  return (
    <box width="100%" height="100%" flexDirection="column" backgroundColor={theme.background}>
      <AgentTabs
        tab={store.tab}
        agents={viewAgents()}
        tasks={store.tasks}
        onSelect={(id) => setStore("tab", id)}
        onClose={(id) => close(id)}
      />
      <AgentPanel
        agent={current()}
        task={task()}
        log={log()}
        onPause={() => pause()}
        onResume={() => resume()}
        onKill={() => kill()}
        onClose={() => close()}
      />
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
          ref={(r: TextareaRenderable) => setArea(r)}
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
