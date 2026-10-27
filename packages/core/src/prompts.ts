import diff from "../prompts/tools/diff.md" with { type: "text" }
import listFiles from "../prompts/tools/list_files.md" with { type: "text" }
import openChange from "../prompts/tools/open_change.md" with { type: "text" }
import readFile from "../prompts/tools/read_file.md" with { type: "text" }
import search from "../prompts/tools/search.md" with { type: "text" }

/** What each tool tells the agent building a tour, by tool name. */
export const TOOL_DESCRIPTIONS = {
  open_change: openChange.trim(),
  list_files: listFiles.trim(),
  read_file: readFile.trim(),
  search: search.trim(),
  diff: diff.trim(),
}
