// Makes a throwaway repo whose saved trek, "pay", uses everything an editor shows, and prints its
import { repoWithShowcase } from "../packages/testing/src"
// path, to open in an editor:
//   code "$(bun scripts/showcase-repo.ts)"

console.log(await repoWithShowcase())
