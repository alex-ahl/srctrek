// Makes a throwaway repo whose saved tour, "pay", uses everything an editor shows, and prints its
// path, to open in an editor:
//   code "$(bun scripts/showcase-repo.ts)"
import { repoWithShowcase } from "../packages/serve/test/support/showcase-tour"

console.log(await repoWithShowcase())
