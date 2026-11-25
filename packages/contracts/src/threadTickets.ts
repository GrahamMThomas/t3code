import * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";

import { IsoDateTime, ThreadId, TrimmedNonEmptyString } from "./baseSchemas.ts";

export const LinearIssueKey = TrimmedNonEmptyString.check(
  Schema.isPattern(/^[A-Z][A-Z0-9]*-[1-9][0-9]*$/),
).pipe(Schema.brand("LinearIssueKey"));
export type LinearIssueKey = typeof LinearIssueKey.Type;

/** bd ids are `<prefix>-<n>`, with `.<n>` per child level. */
export const BeadsTicketId = TrimmedNonEmptyString.check(
  Schema.isPattern(/^[a-z][a-z0-9]*(-[a-z0-9]+)*-[0-9a-z]+(\.[0-9]+)*$/),
).pipe(Schema.brand("BeadsTicketId"));
export type BeadsTicketId = typeof BeadsTicketId.Type;

export const LinearTicketRef = Schema.Struct({
  tracker: Schema.Literal("linear"),
  key: LinearIssueKey,
  url: TrimmedNonEmptyString,
});
export type LinearTicketRef = typeof LinearTicketRef.Type;

export const BeadsTicketRef = Schema.Struct({
  tracker: Schema.Literal("beads"),
  id: BeadsTicketId,
});
export type BeadsTicketRef = typeof BeadsTicketRef.Type;

export const ThreadTicketRef = Schema.Union([LinearTicketRef, BeadsTicketRef]);
export type ThreadTicketRef = typeof ThreadTicketRef.Type;

export const ThreadTicketLinkSource = Schema.Literals(["agent", "branch", "manual"]);
export type ThreadTicketLinkSource = typeof ThreadTicketLinkSource.Type;

const linkFields = { source: ThreadTicketLinkSource, linkedAt: IsoDateTime };

export const ThreadTicketLink = Schema.Union([
  Schema.Struct({ ...LinearTicketRef.fields, ...linkFields }),
  Schema.Struct({ ...BeadsTicketRef.fields, ...linkFields }),
]);
export type ThreadTicketLink = typeof ThreadTicketLink.Type;

/** Lenient so one malformed link from storage or a peer never fails a whole thread. */
export const StoredThreadTickets = Schema.Array(ThreadTicketLink).pipe(
  Schema.catchDecoding(() => Effect.succeedSome([])),
);

const isLinearIssueKey = Schema.is(LinearIssueKey);
const isBeadsTicketId = Schema.is(BeadsTicketId);

export function parseLinearIssueUrl(url: string): LinearTicketRef | null {
  const trimmed = url.trim();
  const key = /^https:\/\/linear\.app\/[^/]+\/issue\/([A-Za-z0-9]+-[0-9]+)(?:[/?#]|$)/
    .exec(trimmed)?.[1]
    ?.toUpperCase();
  return key !== undefined && isLinearIssueKey(key)
    ? { tracker: "linear", key, url: trimmed }
    : null;
}

export function parseBeadsTicketId(id: string): BeadsTicketRef | null {
  const trimmed = id.trim();
  return isBeadsTicketId(trimmed) ? { tracker: "beads", id: trimmed } : null;
}

/** What a person pastes: a Linear issue URL, or a bd ticket id. */
export function parseThreadTicketInput(text: string): ThreadTicketRef | null {
  return parseLinearIssueUrl(text) ?? parseBeadsTicketId(text);
}

function threadTicketIdentity(ticket: ThreadTicketRef): string {
  switch (ticket.tracker) {
    case "linear":
      return `linear:${ticket.key}`;
    case "beads":
      return `beads:${ticket.id}`;
  }
}

export function threadTicketKeysEqual(left: ThreadTicketRef, right: ThreadTicketRef): boolean {
  return threadTicketIdentity(left) === threadTicketIdentity(right);
}

const OptionalText = Schema.optional(Schema.NullOr(Schema.String));

export const BeadsTicketDependency = Schema.Struct({
  id: Schema.String,
  title: Schema.String,
  status: Schema.String,
  dependency_type: Schema.optional(Schema.String),
});
export type BeadsTicketDependency = typeof BeadsTicketDependency.Type;

/** `bd show <id> --json --brief-deps`, keeping only what the viewer shows. */
export const BeadsTicketDetail = Schema.Struct({
  id: Schema.String,
  title: Schema.String,
  status: Schema.String,
  priority: Schema.optional(Schema.Number),
  issue_type: Schema.optional(Schema.String),
  labels: Schema.optional(Schema.NullOr(Schema.Array(Schema.String))),
  description: OptionalText,
  design: OptionalText,
  notes: OptionalText,
  acceptance_criteria: OptionalText,
  close_reason: OptionalText,
  created_at: Schema.optional(Schema.String),
  updated_at: Schema.optional(Schema.String),
  dependencies: Schema.optional(Schema.NullOr(Schema.Array(BeadsTicketDependency))),
});
export type BeadsTicketDetail = typeof BeadsTicketDetail.Type;

export const ReadBeadsTicketInput = Schema.Struct({
  threadId: ThreadId,
  id: BeadsTicketId,
});
export type ReadBeadsTicketInput = typeof ReadBeadsTicketInput.Type;

export const BeadsTicketReadFailure = Schema.Literals([
  "bd-missing",
  "not-found",
  "no-folder",
  "bad-output",
  "failed",
]);
export type BeadsTicketReadFailure = typeof BeadsTicketReadFailure.Type;

export class BeadsTicketReadError extends Schema.TaggedError<BeadsTicketReadError>()(
  "BeadsTicketReadError",
  { reason: BeadsTicketReadFailure, message: Schema.String },
) {}
