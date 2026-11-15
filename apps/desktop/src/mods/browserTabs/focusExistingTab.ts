import * as NodeServices from "@effect/platform-node/NodeServices";
import * as HostProcess from "@t3tools/shared/HostProcess";
import * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";
import * as ChildProcess from "effect/process/ChildProcess";
import * as ChildProcessSpawner from "effect/process/ChildProcessSpawner";

import { findMatchingTab } from "./matchTab.ts";

// One Apple Event per property list, not per tab, so a hundred tabs stay fast. A Chrome that
// is not running answers no tabs and is not launched.
const LIST_TABS_SCRIPT = `
function run() {
  const chrome = Application("Google Chrome");
  if (!chrome.running()) return "[]";
  const ids = chrome.windows.id();
  const urls = chrome.windows.tabs.url();
  return JSON.stringify(ids.flatMap((windowId, w) =>
    urls[w].map((url, t) => ({ windowId, tabIndex: t + 1, url }))));
}`;

const FOCUS_TAB_SCRIPT = `
function run(argv) {
  const chrome = Application("Google Chrome");
  const win = chrome.windows.byId(Number(argv[0]));
  win.activeTabIndex = Number(argv[1]);
  win.index = 1;
  chrome.activate();
}`;

const decodeTabs = Schema.decodeUnknownEffect(
  Schema.fromJsonString(
    Schema.Array(
      Schema.Struct({ windowId: Schema.Number, tabIndex: Schema.Number, url: Schema.String }),
    ),
  ),
);

const osascript = Effect.fn("browserTabs.osascript")(function* (
  script: string,
  args: ReadonlyArray<string>,
) {
  const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;
  return yield* spawner.string(
    ChildProcess.make("/usr/bin/osascript", ["-l", "JavaScript", "-e", script, ...args], {
      stdin: "ignore",
      stderr: "ignore",
    }),
  );
});

const focusMatchingTab = Effect.fn("browserTabs.focusMatchingTab")(function* (url: string) {
  const tabs = yield* decodeTabs(yield* osascript(LIST_TABS_SCRIPT, []));
  const match = findMatchingTab(tabs, url);
  if (match === undefined) return false;
  yield* osascript(FOCUS_TAB_SCRIPT, [String(match.windowId), String(match.tabIndex)]);
  return true;
});

/**
 * Brings forward the Chrome tab that already shows `url`. Succeeds with false when there is
 * none, or when Chrome cannot be asked (not running, Automation permission denied), so the
 * caller opens the link as usual.
 */
export const focusExistingTab = Effect.fn("browserTabs.focusExistingTab")(function* (url: string) {
  if ((yield* HostProcess.Platform) !== "darwin") return false;
  return yield* focusMatchingTab(url).pipe(
    Effect.timeout("3 seconds"),
    Effect.orElseSucceed(() => false),
    Effect.provide(NodeServices.layer),
  );
});
