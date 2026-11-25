import {
  CommandId,
  type OrchestrationV2AppThread,
  type OrchestrationV2DomainEvent,
  type ThreadId,
} from "@t3tools/contracts";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import type * as Scope from "effect/Scope";
import * as Stream from "effect/Stream";

import { forkParked } from "../serverActivation.ts";
import * as ServerSettings from "../serverSettings.ts";
import { linearIssueForBranchChange } from "../tickets/linearBranchKey.ts";
import * as Orchestrator from "./Orchestrator.ts";

export class TicketBranchLinkReactor extends Context.Service<
  TicketBranchLinkReactor,
  {
    readonly start: () => Effect.Effect<void, never, Scope.Scope>;
    readonly handle: (event: OrchestrationV2DomainEvent) => Effect.Effect<void>;
  }
>()("t3/orchestration-v2/TicketBranchLinkReactor") {}

const threadOf = (event: OrchestrationV2DomainEvent): OrchestrationV2AppThread | null =>
  event.type === "thread.created" || event.type === "thread.metadata-updated"
    ? event.payload
    : null;

const make = Effect.gen(function* () {
  const engine = yield* Orchestrator.OrchestratorV2;
  const settings = yield* ServerSettings.ServerSettingsService;
  // A restart forgets the last branches, so one unlinked ticket may relink once after it.
  const lastBranch = new Map<ThreadId, string | null>();

  const handle: TicketBranchLinkReactor["Service"]["handle"] = Effect.fnUntraced(
    function* (event) {
      const thread = threadOf(event);
      if (thread === null) return;
      const previousBranch = lastBranch.get(thread.id);
      lastBranch.set(thread.id, thread.branch);
      const { ticketLinks } = yield* settings.getSettings;
      const issue = linearIssueForBranchChange({ thread, previousBranch, settings: ticketLinks });
      if (issue === null) return;
      yield* engine.dispatch({
        type: "thread.ticket.link",
        commandId: CommandId.make(`server:ticket-branch-link:${event.id}`),
        threadId: thread.id,
        ticket: { tracker: "linear", ...issue },
        source: "branch",
      });
    },
    (effect, event) =>
      effect.pipe(
        Effect.catchCause((cause) =>
          Effect.logWarning("linking a ticket from the thread branch failed", {
            threadId: event.threadId,
            cause,
          }),
        ),
      ),
  );

  const start: TicketBranchLinkReactor["Service"]["start"] = () =>
    forkParked(
      Stream.runForEach(engine.streamDomainEvents, handle).pipe(
        Effect.catchCause((cause) =>
          Effect.logWarning("ticket branch link event stream failed", { cause }),
        ),
      ),
    );

  return { start, handle } satisfies TicketBranchLinkReactor["Service"];
});

export const layer = Layer.effect(TicketBranchLinkReactor, make);
