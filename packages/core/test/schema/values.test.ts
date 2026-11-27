import { describe, expect, test } from "bun:test"
import { markerProblem, valueParts, withoutMarkers } from "../../src"

describe("valueParts", () => {
  test("splits text at the values the agent marked, the markers left out", () => {
    expect(valueParts("POST /refunds with { order: «o_1002», amount: «40» }")).toEqual([
      { text: "POST /refunds with { order: ", value: false },
      { text: "o_1002", value: true },
      { text: ", amount: ", value: false },
      { text: "40", value: true },
      { text: " }", value: false },
    ])
  })

  test("is the text whole where nothing is marked", () => {
    expect(valueParts("a ledger row")).toEqual([{ text: "a ledger row", value: false }])
  })
})

describe("withoutMarkers", () => {
  test("is the text as a reader says it", () => {
    expect(withoutMarkers("a row of «4000» cents")).toBe("a row of 4000 cents")
  })
})

describe("markerProblem", () => {
  test("has none for values marked in pairs", () => {
    expect(markerProblem("«o_1002» and «40»")).toBeUndefined()
  })

  test("names a value left open, one closed that wasn't opened, one inside another, and an empty one", () => {
    expect(markerProblem("amount «40")).toBe("a value opened with « is never closed with »")
    expect(markerProblem("amount 40» cents")).toBe("» closes a value that was never opened with «")
    expect(markerProblem("«a «b» c»")).toBe("a value is opened with « inside another")
    expect(markerProblem("amount «»")).toBe("«» marks no value")
  })
})
