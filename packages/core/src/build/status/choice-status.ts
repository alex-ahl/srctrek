import { type ChangeChoice, choiceArguments } from "../../change/choices"
import { changeFromArguments } from "../../change/from-arguments"
import { type TrekStatus, trekStatus } from "./status"

/** Where the trek of a choice stands, worked out as trek would on opening that change. */
export async function choiceStatus(cwd: string, choice: ChangeChoice): Promise<TrekStatus> {
  return trekStatus(cwd, await changeFromArguments(cwd, choiceArguments(choice)))
}
