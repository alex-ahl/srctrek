type Fields = Record<string, unknown>

function isFields(value: unknown): value is Fields {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function parseFields(line: string): Fields | undefined {
  try {
    const value: unknown = JSON.parse(line)
    return isFields(value) ? value : undefined
  } catch {
    return undefined
  }
}

// "name value · name value" for the fields holding a number other than zero.
function numbersIn(fields: Fields): string | undefined {
  const shown = Object.entries(fields).filter(([, value]) => typeof value === "number" && value)
  if (shown.length === 0) {
    return undefined
  }

  return shown.map(([name, value]) => `${name} ${String(value)}`).join(" · ")
}

// One level down, each object's numbers on a line of their own, after the object's name.
function nestedNumbers(fields: Fields): string[] {
  return Object.entries(fields).flatMap(([name, value]) => {
    const numbers = isFields(value) ? numbersIn(value) : undefined
    return numbers === undefined ? [] : [`${name}: ${numbers}`]
  })
}

/**
 * The agent's last line made readable: when it is JSON, as agents print a summary of their
 * usage, its numbers, top level first, then one level down; any other line as it is. No
 * field names are assumed, so this holds for any agent.
 */
export function agentNumbers(line: string): string[] {
  const fields = parseFields(line)
  if (fields === undefined) {
    return [line]
  }

  const topLevel = numbersIn(fields)

  return [...(topLevel === undefined ? [] : [topLevel]), ...nestedNumbers(fields)]
}
