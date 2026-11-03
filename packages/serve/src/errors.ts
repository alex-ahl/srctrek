/** A request core can't carry out, with the protocol's code for why. */
export class RequestError extends Error {
  constructor(
    readonly code: number,
    message: string,
  ) {
    super(message)
  }
}
