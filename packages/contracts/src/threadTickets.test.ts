import { assert, it } from "@effect/vitest";
import * as Schema from "effect/Schema";

import {
  BeadsTicketId,
  LinearIssueKey,
  StoredThreadTickets,
  parseThreadTicketInput,
} from "./threadTickets.ts";

const isLinearIssueKey = Schema.is(LinearIssueKey);
const isBeadsTicketId = Schema.is(BeadsTicketId);
const decodeStored = Schema.decodeUnknownSync(StoredThreadTickets);

it.each([
  ["NRX-412", true],
  ["T3-7", true],
  ["nrx-412", false],
  ["NRX-0", false],
  ["NRX412", false],
])("Linear key %s valid: %s", (value, valid) => {
  assert.equal(isLinearIssueKey(value), valid);
});

it.each([
  ["jax-16", true],
  ["jax-145.1", true],
  ["jax-145.1.2", true],
  ["my-repo-a3f", true],
  ["JAX-16", false],
  ["jax", false],
  ["jax-145.", false],
])("bd id %s valid: %s", (value, valid) => {
  assert.equal(isBeadsTicketId(value), valid);
});

it.each([
  [
    "https://linear.app/acme/issue/NRX-412/retry-prechart",
    {
      tracker: "linear",
      key: "NRX-412",
      url: "https://linear.app/acme/issue/NRX-412/retry-prechart",
    },
  ],
  [
    "  https://linear.app/acme/issue/nrx-412?x=1 ",
    { tracker: "linear", key: "NRX-412", url: "https://linear.app/acme/issue/nrx-412?x=1" },
  ],
  [" jax-145.1 ", { tracker: "beads", id: "jax-145.1" }],
  ["https://linear.app/acme/project/NRX-412", null],
  ["https://example.com/acme/issue/NRX-412", null],
  ["NRX-412", null],
  ["", null],
])("pasted %j parses to %j", (text, expected) => {
  assert.deepStrictEqual<unknown>(parseThreadTicketInput(text), expected);
});

it("stored links decode both trackers and drop the list when one link is malformed", () => {
  const linkedAt = "2026-11-24T00:00:00.000Z";
  const valid = [
    {
      tracker: "linear",
      key: "NRX-412",
      url: "https://linear.app/acme/issue/NRX-412",
      source: "agent",
      linkedAt,
    },
    { tracker: "beads", id: "jax-145.1", source: "manual", linkedAt },
  ];

  assert.deepStrictEqual<unknown>(decodeStored(valid), valid);
  assert.deepStrictEqual(
    decodeStored([...valid, { tracker: "jira", id: "X-1", source: "agent", linkedAt }]),
    [],
  );
});
