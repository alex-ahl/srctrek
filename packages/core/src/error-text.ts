/** What went wrong, in words: an error's message, or whatever was thrown, as text. */
export function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}
