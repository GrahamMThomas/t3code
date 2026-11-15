import { describe, expect, it } from "vite-plus/test";

import { type BrowserTab, findMatchingTab } from "./matchTab.ts";

const tab = (url: string, tabIndex = 1): BrowserTab => ({ windowId: 7, tabIndex, url });
const PR = "https://github.com/acme/api/pull/12";

describe("findMatchingTab", () => {
  it("matches the same page, ignoring a fragment and a trailing slash", () => {
    const match = tab(`${PR}/#issuecomment-1`, 2);
    expect(findMatchingTab([tab("https://example.com"), match], PR)).toBe(match);
  });

  it("matches a subpage of the same PR", () => {
    const files = tab(`${PR}/files`);
    expect(findMatchingTab([files], PR)).toBe(files);
  });

  it("prefers the PR page itself over its subpage", () => {
    const files = tab(`${PR}/files`, 1);
    const conversation = tab(PR, 2);
    expect(findMatchingTab([files, conversation], PR)).toBe(conversation);
  });

  it("does not match a PR whose number only starts the same", () => {
    expect(findMatchingTab([tab(`${PR}3`)], PR)).toBeUndefined();
  });

  it("matches Forgejo PR subpages", () => {
    const forgejo = "http://localhost:3300/jax/apex/pulls/4";
    const files = tab(`${forgejo}/files`);
    expect(findMatchingTab([files], forgejo)).toBe(files);
  });

  it("does not treat a non-PR page's children as the same page", () => {
    expect(findMatchingTab([tab("https://github.com/acme/api")], "https://github.com/acme")).toBe(
      undefined,
    );
  });

  it("keeps the query string significant", () => {
    expect(findMatchingTab([tab("https://x.dev/search?q=a")], "https://x.dev/search?q=b")).toBe(
      undefined,
    );
  });
});
