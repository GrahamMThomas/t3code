import type { BrowserLinkTarget } from "@t3tools/contracts";

export function opensInDefaultApp(path: string): boolean {
  return /\.(?:html?|pdf)$/i.test(path.split(/[?#]/, 1)[0] ?? "");
}

// Remote clients have no default-app action, so they keep the integrated browser.
export function allowsIntegratedBrowserForFiles(input: {
  readonly linkTarget: BrowserLinkTarget;
  readonly canOpenInDefaultApp: boolean;
}): boolean {
  return input.linkTarget === "app" || !input.canOpenInDefaultApp;
}
