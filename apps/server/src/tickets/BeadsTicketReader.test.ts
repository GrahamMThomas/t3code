import { assert, it } from "@effect/vitest";
import { BeadsTicketReadError } from "@t3tools/contracts";

import * as Schema from "effect/Schema";

import { parseBdShowOutput } from "./BeadsTicketReader.ts";

const isReadError = Schema.is(BeadsTicketReadError);

// Shapes captured from `bd show <id> --json --brief-deps` (bd 1.3.4), with acme data.
const OPEN_TICKET = JSON.stringify([
  {
    id: "acme-7.2",
    title: "Sidebar shows ticket links",
    description: "## Why\nShow tickets.",
    design: "Plan: plans/acme.md",
    notes: "",
    status: "in_progress",
    priority: 2,
    issue_type: "task",
    owner: "dev@acme.test",
    labels: ["plan:quick"],
    dependencies: [
      {
        id: "acme-7.1",
        title: "Store links",
        status: "closed",
        priority: 2,
        issue_type: "task",
        dependency_type: "blocks",
      },
    ],
    created_at: "2026-11-24T23:21:18Z",
    updated_at: "2026-11-25T17:46:30Z",
  },
]);
const NOT_FOUND = JSON.stringify({
  error: "no issues found matching the provided IDs",
  hint: "some IDs may reference deleted/purged records",
  schema_version: 1,
});

const outcome = (result: ReturnType<typeof parseBdShowOutput>) =>
  isReadError(result) ? result.reason : result.id;

it.each([
  ["open ticket", { code: 0, stdout: OPEN_TICKET, timedOut: false }, "acme-7.2"],
  ["not found", { code: 1, stdout: NOT_FOUND, timedOut: false }, "not-found"],
  ["empty list", { code: 0, stdout: "[]", timedOut: false }, "not-found"],
  ["not JSON", { code: 0, stdout: "Issue acme-7.2", timedOut: false }, "bad-output"],
  ["other exit", { code: 2, stdout: "", timedOut: false }, "failed"],
  ["timed out", { code: null, stdout: "", timedOut: true }, "failed"],
] as const)("%s", (_case, output, expected) => {
  assert.equal(outcome(parseBdShowOutput({ id: "acme-7.2", ...output })), expected);
});

it("keeps the fields the viewer shows", () => {
  const ticket = parseBdShowOutput({
    id: "acme-7.2",
    code: 0,
    stdout: OPEN_TICKET,
    timedOut: false,
  });
  if (isReadError(ticket)) return assert.fail(ticket.message);
  assert.equal(ticket.design, "Plan: plans/acme.md");
  assert.deepStrictEqual(
    ticket.dependencies?.map((dependency) => dependency.id),
    ["acme-7.1"],
  );
});
