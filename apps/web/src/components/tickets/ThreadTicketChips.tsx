import type { ScopedThreadRef, ThreadTicketLink } from "@t3tools/contracts";
import type { MouseEvent } from "react";

import { useOpenLink } from "~/browser/useOpenLink";
import { useRightPanelStore } from "~/rightPanelStore";
import { InlineButton } from "../ui/button";
import { toastManager } from "../ui/toast";
import { Tooltip, TooltipPopup, TooltipTrigger } from "../ui/tooltip";

const SOURCE_LABEL: Record<ThreadTicketLink["source"], string> = {
  agent: "Linked by the agent",
  branch: "Linked from the branch name",
  manual: "Linked by you",
};

export function threadTicketLabel(link: ThreadTicketLink): string {
  switch (link.tracker) {
    case "linear":
      return link.key;
    case "beads":
      return link.id;
  }
}

/** Mounted only for rows that have tickets, so unlinked rows pay for no hooks. */
export function ThreadTicketChips({
  threadRef,
  tickets,
}: {
  readonly threadRef: ScopedThreadRef;
  readonly tickets: ReadonlyArray<ThreadTicketLink>;
}) {
  const openLink = useOpenLink(threadRef);
  const open = (event: MouseEvent<HTMLElement>, url: string) => {
    event.preventDefault();
    event.stopPropagation();
    openLink(url, { event }).catch((error: unknown) => {
      toastManager.add({
        type: "error",
        title: "Could not open the ticket",
        description: error instanceof Error ? error.message : String(error),
      });
    });
  };
  return tickets.map((link) => {
    const label = threadTicketLabel(link);
    return (
      <Tooltip key={`${link.tracker}:${label}`}>
        <TooltipTrigger
          render={
            link.tracker === "linear" ? (
              <InlineButton
                aria-label={`Open ${label} in Linear`}
                onPointerDown={(event) => event.stopPropagation()}
                onClick={(event) => open(event, link.url)}
              />
            ) : (
              <InlineButton
                aria-label={`Open bd ticket ${label}`}
                onPointerDown={(event) => event.stopPropagation()}
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  useRightPanelStore.getState().openBeadsTicket(threadRef, link.id);
                }}
              />
            )
          }
        >
          <span className="shrink-0 font-normal text-secondary-label text-xs tabular-nums">
            {label}
          </span>
        </TooltipTrigger>
        <TooltipPopup side="top">{SOURCE_LABEL[link.source]}</TooltipPopup>
      </Tooltip>
    );
  });
}
