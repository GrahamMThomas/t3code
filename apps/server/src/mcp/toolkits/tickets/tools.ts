import {
  McpCapabilityUnavailableError,
  OrchestratorMcpEnvironmentTarget,
  OrchestratorMcpFailure,
  ThreadId,
  TrimmedNonEmptyString,
} from "@t3tools/contracts";
import * as Schema from "effect/Schema";
import * as Tool from "effect/ai/Tool";
import * as Toolkit from "effect/ai/Toolkit";

import * as McpInvocationContext from "../../McpInvocationContext.ts";
import * as Orchestrator from "../../../orchestration-v2/Orchestrator.ts";
import * as ThreadManagementService from "../../../orchestration-v2/ThreadManagementService.ts";

const dependencies = [
  McpInvocationContext.McpInvocationContext,
  ThreadManagementService.ThreadManagementService,
  Orchestrator.OrchestratorV2,
];

export const TicketTargetInput = Schema.Struct({
  environmentId: OrchestratorMcpEnvironmentTarget,
  threadId: Schema.optional(ThreadId.annotate({ description: "Thread. Default: this thread." })),
  linearUrl: Schema.optional(
    TrimmedNonEmptyString.annotate({
      description: "Linear issue URL, like https://linear.app/acme/issue/NRX-412. Or pass bdId.",
    }),
  ),
  bdId: Schema.optional(
    TrimmedNonEmptyString.annotate({ description: "bd (beads) ticket id, like jax-145.1." }),
  ),
});
export type TicketTargetInput = typeof TicketTargetInput.Type;

export class TicketTargetInvalidError extends Schema.TaggedError<TicketTargetInvalidError>()(
  "TicketTargetInvalidError",
  { detail: Schema.String },
) {
  override get message(): string {
    return this.detail;
  }
}

export class TicketThreadRequiredError extends Schema.TaggedError<TicketThreadRequiredError>()(
  "TicketThreadRequiredError",
  {},
) {
  override get message(): string {
    return "Pass threadId: this MCP client is not running inside a T3 thread.";
  }
}

export class TicketLinkFailedError extends Schema.TaggedError<TicketLinkFailedError>()(
  "TicketLinkFailedError",
  { cause: Schema.Defect() },
) {
  override get message(): string {
    return "Could not change the thread's ticket links.";
  }
}

const TicketToolError = Schema.Union([
  OrchestratorMcpFailure,
  McpCapabilityUnavailableError,
  TicketTargetInvalidError,
  TicketThreadRequiredError,
  TicketLinkFailedError,
]);

const ThreadTicketEntry = Schema.Struct({
  tracker: Schema.Literals(["linear", "beads"]),
  id: Schema.String,
  url: Schema.optional(Schema.String),
});

const TicketLinksResult = Schema.Struct({
  changed: Schema.Boolean,
  tickets: Schema.Array(ThreadTicketEntry),
});
export type TicketLinksResult = typeof TicketLinksResult.Type;

const LinkTicketTool = Tool.make("link_ticket", {
  description:
    "Link the Linear issue or bd ticket this thread works on, so it shows in the sidebar. Pass linearUrl or bdId. Returns the thread's tickets.",
  parameters: TicketTargetInput,
  success: TicketLinksResult,
  failure: TicketToolError,
  dependencies,
})
  .annotate(Tool.Title, "Link ticket to thread")
  .annotate(Tool.Readonly, false)
  .annotate(Tool.Destructive, false)
  .annotate(Tool.Idempotent, true)
  .annotate(Tool.OpenWorld, false);

const UnlinkTicketTool = Tool.make("unlink_ticket", {
  description:
    "Remove a Linear issue or bd ticket link from this thread. Pass linearUrl or bdId. Returns the thread's tickets.",
  parameters: TicketTargetInput,
  success: TicketLinksResult,
  failure: TicketToolError,
  dependencies,
})
  .annotate(Tool.Title, "Unlink ticket from thread")
  .annotate(Tool.Readonly, false)
  .annotate(Tool.Destructive, false)
  .annotate(Tool.Idempotent, true)
  .annotate(Tool.OpenWorld, false);

export const TicketsToolkit = Toolkit.make(LinkTicketTool, UnlinkTicketTool);
