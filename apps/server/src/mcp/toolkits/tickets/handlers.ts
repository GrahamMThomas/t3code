import {
  CommandId,
  parseBeadsTicketId,
  parseLinearIssueUrl,
  type ThreadId,
  type ThreadTicketLink,
  type ThreadTicketRef,
  threadTicketKeysEqual,
} from "@t3tools/contracts";
import * as Cause from "effect/Cause";
import * as SecureRandom from "effect/crypto/SecureRandom";
import * as Effect from "effect/Effect";
import * as Option from "effect/Option";

import * as Orchestrator from "../../../orchestration-v2/Orchestrator.ts";
import * as McpInvocationContext from "../../McpInvocationContext.ts";
import * as McpToolAccess from "../../McpToolAccess.ts";
import { threadNotFound } from "../../threadAccess.ts";
import {
  TicketLinkFailedError,
  type TicketLinksResult,
  TicketTargetInvalidError,
  type TicketTargetInput,
  TicketThreadRequiredError,
  TicketsToolkit,
} from "./tools.ts";

export function ticketRefFromTarget(input: TicketTargetInput): ThreadTicketRef | string {
  if ((input.linearUrl === undefined) === (input.bdId === undefined)) {
    return "Pass exactly one of linearUrl or bdId.";
  }
  if (input.bdId !== undefined) {
    return parseBeadsTicketId(input.bdId) ?? `${input.bdId} is not a bd ticket id, like jax-145.1.`;
  }
  const url = input.linearUrl ?? "";
  return (
    parseLinearIssueUrl(url) ??
    `${url} is not a Linear issue URL, like https://linear.app/acme/issue/NRX-412.`
  );
}

function entryOf(link: ThreadTicketLink): TicketLinksResult["tickets"][number] {
  switch (link.tracker) {
    case "linear":
      return { tracker: "linear", id: link.key, url: link.url };
    case "beads":
      return { tracker: "beads", id: link.id };
  }
}

const make = Effect.gen(function* () {
  const engine = yield* Orchestrator.OrchestratorV2;
  const random = yield* SecureRandom.SecureRandom;

  const commandId = (threadId: ThreadId) =>
    random.uuidV4().pipe(
      Effect.orDie,
      Effect.map((uuid) => CommandId.make(`server:mcp-ticket-link:${threadId}:${uuid}`)),
    );

  const readTickets = Effect.fn("TicketsToolkit.readTickets")(function* (threadId: ThreadId) {
    const thread = yield* engine.getThreadShell(threadId).pipe(
      Effect.map(Option.fromNullishOr),
      Effect.mapError((cause) => new TicketLinkFailedError({ cause })),
    );
    if (Option.isNone(thread) || thread.value.deletedAt !== null) {
      return yield* threadNotFound(engine, threadId, `Thread ${threadId} was not found.`);
    }
    return thread.value.tickets ?? [];
  });

  const changeLink = Effect.fn("TicketsToolkit.changeLink")(function* (
    input: TicketTargetInput,
    linked: boolean,
  ) {
    const scope = yield* McpInvocationContext.requireMcpCapability("pull-requests");
    const threadId = input.threadId ?? scope.thread?.threadId;
    if (threadId === undefined) return yield* new TicketThreadRequiredError();
    const ticket = ticketRefFromTarget(input);
    if (typeof ticket === "string") return yield* new TicketTargetInvalidError({ detail: ticket });
    const before = yield* readTickets(threadId);
    const changed = before.some((link) => threadTicketKeysEqual(link, ticket)) !== linked;
    if (changed) {
      yield* engine
        .dispatch(
          linked
            ? {
                type: "thread.ticket.link",
                commandId: yield* commandId(threadId),
                threadId,
                ticket,
                source: "agent",
              }
            : {
                type: "thread.ticket.unlink",
                commandId: yield* commandId(threadId),
                threadId,
                ticket,
              },
        )
        .pipe(
          Effect.catchCause((cause) =>
            Cause.hasInterruptsOnly(cause)
              ? Effect.interrupt
              : Effect.fail(new TicketLinkFailedError({ cause })),
          ),
        );
    }
    const after = changed ? yield* readTickets(threadId) : before;
    return { changed, tickets: after.map(entryOf) } satisfies TicketLinksResult;
  });

  return {
    link_ticket: McpToolAccess.writesThreads(
      (input: TicketTargetInput) => [input.threadId],
      (input: TicketTargetInput) => changeLink(input, true),
    ),
    unlink_ticket: McpToolAccess.writesThreads(
      (input: TicketTargetInput) => [input.threadId],
      (input: TicketTargetInput) => changeLink(input, false),
    ),
  } satisfies McpToolAccess.Handlers<typeof TicketsToolkit.tools>;
});

export const layer = McpToolAccess.toLayer(TicketsToolkit, make);
