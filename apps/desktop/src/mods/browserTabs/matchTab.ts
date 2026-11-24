import * as Schema from "effect/Schema";

/** One open browser tab, addressed the way Chrome's scripting API addresses it. */
const BrowserTab = Schema.Struct({
  // Chrome's scripting API returns window ids as strings.
  windowId: Schema.String,
  /** 1-based, as Chrome's `activeTabIndex` expects. */
  tabIndex: Schema.Number,
  url: Schema.String,
});
export type BrowserTab = typeof BrowserTab.Type;

export const decodeBrowserTabs = Schema.decodeUnknownEffect(
  Schema.fromJsonString(Schema.Array(BrowserTab)),
);

// A PR page's own subpages (/files, /commits) count as the same PR.
const PULL_REQUEST_PATH = /\/(?:pull|pulls|merge_requests)\/\d+$/;

interface PageKey {
  readonly page: string;
  readonly search: string;
}

function pageKey(rawUrl: string): PageKey | undefined {
  try {
    const url = new URL(rawUrl);
    const path = url.pathname.replace(/\/+$/, "");
    return { page: `${url.origin}${path}`, search: url.search };
  } catch {
    return undefined;
  }
}

function isSamePage(target: PageKey, tab: PageKey): boolean {
  return tab.page === target.page && tab.search === target.search;
}

function isPullRequestSubpage(target: PageKey, tab: PageKey): boolean {
  return PULL_REQUEST_PATH.test(target.page) && tab.page.startsWith(`${target.page}/`);
}

/** The tab already showing `targetUrl`: the same page first, else a subpage of the same PR. */
export function findMatchingTab(
  tabs: ReadonlyArray<BrowserTab>,
  targetUrl: string,
): BrowserTab | undefined {
  const target = pageKey(targetUrl);
  if (target === undefined) return undefined;
  const keyed = tabs.flatMap((tab) => {
    const key = pageKey(tab.url);
    return key === undefined ? [] : [{ tab, key }];
  });
  return (
    keyed.find(({ key }) => isSamePage(target, key))?.tab ??
    keyed.find(({ key }) => isPullRequestSubpage(target, key))?.tab
  );
}
