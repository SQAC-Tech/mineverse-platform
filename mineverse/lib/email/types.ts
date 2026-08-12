/** Provider-neutral attachment. `cid` makes it inline via `cid:<value>` in the HTML. */
export type EmailAttachment = {
  filename: string;
  content: Buffer;
  cid?: string;
};

export type TransportResult = {
  success: boolean;
  /** Provider-side message id, when the send was accepted. */
  id?: string;
  error?: string;
};
