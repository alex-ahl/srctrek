// Prompt files are imported as text (`with { type: "text" }`), so the compiled binary embeds them.
declare module "*.md" {
  const text: string
  export default text
}
