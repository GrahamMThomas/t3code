import { assert, it } from "@effect/vitest";
import * as Schema from "effect/Schema";

import { BeadsTicketId, LinearIssueKey, StoredThreadTickets } from "./threadTickets.ts";

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
