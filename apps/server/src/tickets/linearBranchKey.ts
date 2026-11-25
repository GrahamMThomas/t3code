import {
  LinearIssueKey,
  type OrchestrationV2AppThread,
  type TicketLinkSettings,
} from "@t3tools/contracts";
import * as Schema from "effect/Schema";

const isLinearIssueKey = Schema.is(LinearIssueKey);

/** Linear's branch names put the key first in the last segment: `gthomas/nrx-412-retry`. */
export function linearKeyFromBranch(
  branch: string,
  teamKeys: ReadonlyArray<string>,
): LinearIssueKey | null {
  const segment = branch.slice(branch.lastIndexOf("/") + 1);
  const match = /^([a-z][a-z0-9]*)-([0-9]+)(?:-|$)/i.exec(segment);
  if (match === null) return null;
  const [, team = "", number = ""] = match;
  const listed = teamKeys.some((key) => key.toUpperCase() === team.toUpperCase());
  const key = `${team.toUpperCase()}-${number}`;
  return listed && isLinearIssueKey(key) ? key : null;
}

export function linearIssueFromBranch(
  branch: string,
  settings: TicketLinkSettings,
): { readonly key: LinearIssueKey; readonly url: string } | null {
  if (settings.linearWorkspace === "") return null;
  const key = linearKeyFromBranch(branch, settings.linearTeamKeys);
  if (key === null) return null;
  return {
    key,
    url: `https://linear.app/${encodeURIComponent(settings.linearWorkspace)}/issue/${key}`,
  };
}

/** Links only when the branch changed, so a ticket unlinked by hand stays unlinked. */
export function linearIssueForBranchChange(input: {
  readonly thread: Pick<OrchestrationV2AppThread, "branch" | "tickets">;
  readonly previousBranch: string | null | undefined;
  readonly settings: TicketLinkSettings;
}): { readonly key: LinearIssueKey; readonly url: string } | null {
  const { branch, tickets } = input.thread;
  if (branch === null || branch === input.previousBranch) return null;
  const issue = linearIssueFromBranch(branch, input.settings);
  if (issue === null) return null;
  const linked = tickets?.some((link) => link.tracker === "linear" && link.key === issue.key);
  return linked === true ? null : issue;
}
