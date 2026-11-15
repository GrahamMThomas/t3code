import { ThreadId } from "@t3tools/contracts";
import { describe, expect, it } from "vite-plus/test";

import { identicon, threadCallsign } from "./callsign";
import { CALLSIGN_WORDS } from "./callsignWords";

describe("threadCallsign", () => {
  it("gives a thread the same word from the list every time", () => {
    const threadId = ThreadId.make("thread-1");
    expect(threadCallsign(threadId)).toBe(threadCallsign(threadId));
    expect(CALLSIGN_WORDS).toContain(threadCallsign(threadId));
  });
});

describe("identicon", () => {
  it("mirrors each row on the middle column", () => {
    for (const row of identicon("SHERBET").cells) {
      expect(row).toEqual([...row].reverse());
    }
  });
});
