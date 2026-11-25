import { assert, it } from "@effect/vitest";

import { ticketRefFromTarget } from "./handlers.ts";

it.each([
  [
    { linearUrl: "https://linear.app/acme/issue/NRX-412/retry-prechart" },
    {
      tracker: "linear",
      key: "NRX-412",
      url: "https://linear.app/acme/issue/NRX-412/retry-prechart",
    },
  ],
  [
    { linearUrl: "https://linear.app/acme/issue/nrx-412" },
    { tracker: "linear", key: "NRX-412", url: "https://linear.app/acme/issue/nrx-412" },
  ],
  [{ bdId: "jax-145.1" }, { tracker: "beads", id: "jax-145.1" }],
  [{ linearUrl: "https://linear.app/acme/project/NRX-412" }, "invalid"],
  [{ linearUrl: "https://example.com/acme/issue/NRX-412" }, "invalid"],
  [{ bdId: "JAX 145" }, "invalid"],
  [{}, "invalid"],
  [{ bdId: "jax-1", linearUrl: "https://linear.app/acme/issue/NRX-412" }, "invalid"],
] as const)("%j parses to %j", (input, expected) => {
  const ticket = ticketRefFromTarget(input);
  assert.deepStrictEqual<unknown>(typeof ticket === "string" ? "invalid" : ticket, expected);
});
