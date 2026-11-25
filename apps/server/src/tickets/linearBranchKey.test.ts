import { assert, it } from "@effect/vitest";
import { LinearIssueKey } from "@t3tools/contracts";

import {
  linearIssueForBranchChange,
  linearIssueFromBranch,
  linearKeyFromBranch,
} from "./linearBranchKey.ts";

it.each([
  ["gthomas/nrx-412-prechart-retry", ["NRX"], "NRX-412"],
  ["nrx-412", ["nrx"], "NRX-412"],
  ["feature/team/NRX-7-thing", ["NRX"], "NRX-7"],
  ["agent/fix-2-bugs", ["NRX"], null],
  ["gthomas/nrx-412-retry", [], null],
  ["gthomas/nrx412-retry", ["NRX"], null],
  ["gthomas/retry-nrx-412", ["NRX"], null],
  ["gthomas/nrx-0-retry", ["NRX"], null],
])("%s with teams %j links %s", (branch, teams, expected) => {
  assert.equal(linearKeyFromBranch(branch, teams), expected);
});

it("builds no link without a workspace, and the workspace URL with one", () => {
  const branch = "gthomas/nrx-412-retry";
  assert.isNull(linearIssueFromBranch(branch, { linearWorkspace: "", linearTeamKeys: ["NRX"] }));
  assert.deepStrictEqual(
    linearIssueFromBranch(branch, { linearWorkspace: "acme", linearTeamKeys: ["NRX"] }),
    { key: "NRX-412", url: "https://linear.app/acme/issue/NRX-412" },
  );
});

it.each([
  ["new branch", null, [], "NRX-412"],
  ["first sight after start", undefined, [], "NRX-412"],
  ["same branch again", "gthomas/nrx-412-retry", [], null],
  ["already linked", null, ["NRX-412"], null],
] as const)("branch change: %s", (_case, previousBranch, linkedKeys, expected) => {
  const issue = linearIssueForBranchChange({
    thread: {
      branch: "gthomas/nrx-412-retry",
      tickets: linkedKeys.map((key) => ({
        tracker: "linear",
        key: LinearIssueKey.make(key),
        url: `https://linear.app/acme/issue/${key}`,
        source: "agent",
        linkedAt: "2026-11-24T00:00:00.000Z",
      })),
    },
    previousBranch,
    settings: { linearWorkspace: "acme", linearTeamKeys: ["NRX"] },
  });
  assert.equal<string | null>(issue?.key ?? null, expected);
});
