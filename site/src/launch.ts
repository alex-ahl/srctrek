// Switches for going live, each flipped on its own.

// True once a release carries the binaries the install script downloads; until then the page
// says the install is coming instead of showing a command that fails.
export const RELEASED = false

// True once the site is finished; until then search engines are asked to leave it out.
export const INDEXED = false
