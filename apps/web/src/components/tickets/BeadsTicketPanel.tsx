import {
  type BeadsTicketDetail,
  BeadsTicketId,
  BeadsTicketReadError,
  type BeadsTicketReadFailure,
  type ScopedThreadRef,
} from "@t3tools/contracts";
import * as Schema from "effect/Schema";
import { RefreshCwIcon } from "lucide-react";

import { useRightPanelStore } from "~/rightPanelStore";
import { useEnvironmentQuery } from "~/state/query";
import { threadEnvironment } from "~/state/threads";
import ChatMarkdown from "../ChatMarkdown";
import { Button, InlineButton } from "../ui/button";

const isBeadsTicketId = Schema.is(BeadsTicketId);
const isReadError = Schema.is(BeadsTicketReadError);

const FAILURE_TEXT: Record<BeadsTicketReadFailure, string> = {
  "bd-missing": "bd isn't installed on the machine this thread runs on.",
  "not-found": "bd has no ticket with this id.",
  "no-folder": "This thread has no project folder to run bd in.",
  "bad-output": "bd answered with output T3 Code can't read.",
  failed: "bd couldn't read this ticket.",
};

const SECTIONS = [
  ["Description", "description"],
  ["Design", "design"],
  ["Acceptance criteria", "acceptance_criteria"],
  ["Notes", "notes"],
  ["Outcome", "close_reason"],
] as const satisfies ReadonlyArray<readonly [string, keyof BeadsTicketDetail]>;

export function BeadsTicketPanel({
  threadRef,
  ticketId,
}: {
  readonly threadRef: ScopedThreadRef;
  readonly ticketId: string;
}) {
  const query = useEnvironmentQuery(
    isBeadsTicketId(ticketId)
      ? threadEnvironment.readBeadsTicket({
          environmentId: threadRef.environmentId,
          input: { threadId: threadRef.threadId, id: ticketId },
        })
      : null,
  );
  const failure = isReadError(query.failure) ? FAILURE_TEXT[query.failure.reason] : query.error;
  const ticket = query.data;

  return (
    <div className="flex h-full min-h-0 flex-col overflow-y-auto p-4 text-sm">
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <div className="text-muted-foreground text-xs tabular-nums">
            {ticketId}
            {ticket
              ? ` · ${ticket.status} · ${ticket.issue_type ?? "ticket"}${ticket.priority === undefined ? "" : ` · P${ticket.priority}`}`
              : null}
          </div>
          <h2 className="font-medium text-base">
            {ticket?.title ?? (query.isPending ? "Loading…" : "")}
          </h2>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          aria-label="Refresh ticket"
          disabled={query.isPending}
          onClick={query.refresh}
        >
          <RefreshCwIcon aria-hidden className="size-3.5" />
        </Button>
      </div>
      {failure !== null && ticket === null ? (
        <p className="mt-3 text-destructive text-xs">{failure}</p>
      ) : null}
      {ticket
        ? SECTIONS.map(([heading, key]) => {
            const text = ticket[key];
            return typeof text === "string" && text.trim() !== "" ? (
              <section key={key} className="mt-4">
                <h3 className="mb-1 font-medium text-muted-foreground text-xs">{heading}</h3>
                <ChatMarkdown text={text} cwd={undefined} threadRef={threadRef} />
              </section>
            ) : null;
          })
        : null}
      {ticket?.dependencies?.length ? (
        <section className="mt-4">
          <h3 className="mb-1 font-medium text-muted-foreground text-xs">Dependencies</h3>
          <ul className="flex flex-col gap-1">
            {ticket.dependencies.map((dependency) => (
              <li key={dependency.id} className="flex min-w-0 items-baseline gap-2">
                <InlineButton
                  onClick={() =>
                    useRightPanelStore.getState().openBeadsTicket(threadRef, dependency.id)
                  }
                >
                  <span className="tabular-nums">{dependency.id}</span>
                </InlineButton>
                <span className="min-w-0 flex-1 truncate">{dependency.title}</span>
                <span className="text-muted-foreground text-xs">{dependency.status}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
