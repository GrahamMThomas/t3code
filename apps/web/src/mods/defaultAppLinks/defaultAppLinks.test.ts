import { describe, expect, it } from "vite-plus/test";

import { allowsIntegratedBrowserForFiles, opensInDefaultApp } from "./defaultAppLinks";

describe("opensInDefaultApp", () => {
  it.each([
    ["/tmp/report.html", true],
    ["docs/Index.HTM", true],
    ["/tmp/paper.pdf?page=2#top", true],
    ["README.md", false],
    ["/tmp/archive.pdfx", false],
    ["/tmp/page.html.bak", false],
  ])("%s → %s", (path, expected) => {
    expect(opensInDefaultApp(path)).toBe(expected);
  });
});

describe("allowsIntegratedBrowserForFiles", () => {
  it.each([
    ["system", true, false],
    ["app", true, true],
    ["system", false, true],
    ["app", false, true],
  ] as const)("linkTarget %s, default app %s → %s", (linkTarget, canOpenInDefaultApp, expected) => {
    expect(allowsIntegratedBrowserForFiles({ linkTarget, canOpenInDefaultApp })).toBe(expected);
  });
});
