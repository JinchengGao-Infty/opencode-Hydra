import { describe, expect, test } from "bun:test"
import { HydraBus, HydraEvent } from "../../src/hydra/event"

describe("Hydra Event", () => {
  test("emit() validates payload with Zod", () => {
    HydraBus.clearHistory()

    expect(() => {
      HydraBus.emit(HydraEvent.TaskCreated, {
        taskId: "t001",
        title: "Example",
      })
    }).not.toThrow()

    expect(() => {
      const bad = { taskId: "t001" } as unknown as { taskId: string; title: string }
      HydraBus.emit(HydraEvent.TaskCreated, bad)
    }).toThrow()
  })

  test("on() subscribes and unsubscribe removes handler", () => {
    HydraBus.clearHistory()

    const list: Array<{ taskId: string; title: string }> = []

    const unsub = HydraBus.on(HydraEvent.TaskCreated, (data) => {
      list.push(data)
    })

    expect(HydraBus.subscriberCount(HydraEvent.TaskCreated)).toBe(1)

    HydraBus.emit(HydraEvent.TaskCreated, {
      taskId: "t001",
      title: "A",
    })

    unsub()

    HydraBus.emit(HydraEvent.TaskCreated, {
      taskId: "t002",
      title: "B",
    })

    expect(list.map((x) => x.taskId)).toEqual(["t001"])
    expect(HydraBus.subscriberCount(HydraEvent.TaskCreated)).toBe(0)
  })

  test("handler errors do not prevent other handlers from running", () => {
    HydraBus.clearHistory()

    const list: string[] = []
    const prev = console.error
    console.error = () => {}

    try {
      const a = HydraBus.on(HydraEvent.TaskCreated, () => {
        throw new Error("boom")
      })

      const b = HydraBus.on(HydraEvent.TaskCreated, (data) => {
        list.push(data.taskId)
      })

      expect(() => {
        HydraBus.emit(HydraEvent.TaskCreated, {
          taskId: "t001",
          title: "A",
        })
      }).not.toThrow()

      a()
      b()
    } finally {
      console.error = prev
    }

    expect(list).toEqual(["t001"])
  })

  test("once() resolves on matching event and supports filters", async () => {
    HydraBus.clearHistory()

    const promise = HydraBus.once(HydraEvent.TaskCompleted, (data) => data.taskId === "t001")
    expect(HydraBus.subscriberCount(HydraEvent.TaskCompleted)).toBe(1)

    HydraBus.emit(HydraEvent.TaskCompleted, {
      taskId: "t002",
      agentId: "a",
      output: "no",
      filesChanged: [],
    })

    HydraBus.emit(HydraEvent.TaskCompleted, {
      taskId: "t001",
      agentId: "a",
      output: "ok",
      filesChanged: ["a.ts"],
    })

    const data = await promise
    expect(data.taskId).toBe("t001")
    expect(data.output).toBe("ok")
    expect(HydraBus.subscriberCount(HydraEvent.TaskCompleted)).toBe(0)
  })

  test("once() rejects on timeout", async () => {
    HydraBus.clearHistory()

    const promise = HydraBus.once(HydraEvent.TaskCancelled, undefined, 25)
    expect(HydraBus.subscriberCount(HydraEvent.TaskCancelled)).toBe(1)

    await expect(promise).rejects.toThrow(`Timeout waiting for ${HydraEvent.TaskCancelled.type}`)
    expect(HydraBus.subscriberCount(HydraEvent.TaskCancelled)).toBe(0)
  })

  test("history records events and supports filtering and limits", () => {
    HydraBus.clearHistory()

    for (const i of Array.from({ length: 105 }).keys()) {
      HydraBus.emit(HydraEvent.TaskCreated, {
        taskId: String(i),
        title: "X",
      })
    }

    const list = HydraBus.getHistory()
    expect(list.length).toBe(100)

    const first = list[0]
    expect(first?.type).toBe(HydraEvent.TaskCreated.type)
    expect((first?.data as { taskId: string }).taskId).toBe("5")

    expect(HydraBus.getHistory({ limit: 1 }).length).toBe(1)
    expect(HydraBus.getHistory({ type: HydraEvent.TaskCreated.type, limit: 2 }).length).toBe(2)

    HydraBus.clearHistory()
    expect(HydraBus.getHistory().length).toBe(0)
  })
})
