import { HydraEvent } from "./events"

type Handler<T> = (data: T) => void | Promise<void>

export namespace HydraBus {
  const handlers = new Map<string, Set<Handler<unknown>>>()
  const history: Array<{ type: string; data: unknown; timestamp: Date }> = []
  const MAX_HISTORY = 100

  export function on<T>(event: HydraEvent.Event<T>, handler: Handler<T>): () => void {
    const set = handlers.get(event.type) ?? new Set()
    set.add(handler as Handler<unknown>)
    handlers.set(event.type, set)

    return () => {
      set.delete(handler as Handler<unknown>)
      if (set.size === 0) handlers.delete(event.type)
    }
  }

  export function emit<T>(event: HydraEvent.Event<T>, data: T): void {
    const parsed = event.schema.parse(data)

    history.push({
      type: event.type,
      data: parsed,
      timestamp: new Date(),
    })

    if (history.length > MAX_HISTORY) history.shift()

    const set = handlers.get(event.type)
    if (!set) return

    for (const handler of set) {
      try {
        const result = handler(parsed as unknown)
        if (result instanceof Promise) {
          result.catch((err) => {
            console.error(`[HydraBus] Handler error for ${event.type}:`, err)
          })
        }
      } catch (err) {
        console.error(`[HydraBus] Handler error for ${event.type}:`, err)
      }
    }
  }

  export function once<T>(
    event: HydraEvent.Event<T>,
    filter?: (data: T) => boolean,
    timeout?: number,
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      const state: { timer?: ReturnType<typeof setTimeout> } = {}

      const unsub = on(event, (data) => {
        if (filter && !filter(data)) return
        if (state.timer) clearTimeout(state.timer)
        unsub()
        resolve(data)
      })

      state.timer = timeout
        ? setTimeout(() => {
            unsub()
            reject(new Error(`Timeout waiting for ${event.type}`))
          }, timeout)
        : undefined
    })
  }

  export function getHistory(filter?: {
    type?: string
    limit?: number
  }): Array<{ type: string; data: unknown; timestamp: Date }> {
    const list = filter?.type ? history.filter((e) => e.type === filter.type) : [...history]
    if (!filter?.limit) return list
    return list.slice(-filter.limit)
  }

  export function clearHistory(): void {
    history.length = 0
  }

  export function subscriberCount<T>(event: HydraEvent.Event<T>): number {
    return handlers.get(event.type)?.size ?? 0
  }
}

