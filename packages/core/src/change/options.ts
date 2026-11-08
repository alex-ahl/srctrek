/** A trek of code as it is, with no change: the trigger to follow, in the user's words. */
export type CodeTrek = Readonly<{ trigger: string | undefined }>

export type Options = { uncommitted: boolean; code: CodeTrek | undefined; words: string[] }

const UNCOMMITTED = "--uncommitted"
const CODE = "--code"

function isCodeOption(arg: string): boolean {
  return arg === CODE || arg.startsWith(`${CODE}=`)
}

// --code alone leaves the trigger to the agent; --code="a refund request" names it.
function codeTrek(args: string[]): CodeTrek | undefined {
  const option = args.find(isCodeOption)
  if (option === undefined) {
    return undefined
  }

  const trigger = option.slice(`${CODE}=`.length).trim()
  return { trigger: trigger === "" ? undefined : trigger }
}

/**
 * trek's options, and the words left for repos and changes. Options start with "-", which no
 * git ref, path, or URL does.
 */
export function readOptions(args: string[]): Options {
  const isOption = (arg: string) => arg.startsWith("-")
  const unknown = args.find((arg) => isOption(arg) && arg !== UNCOMMITTED && !isCodeOption(arg))
  if (unknown !== undefined) {
    throw new Error(`unknown option ${unknown}`)
  }

  return {
    uncommitted: args.includes(UNCOMMITTED),
    code: codeTrek(args),
    words: args.filter((arg) => !isOption(arg)),
  }
}
