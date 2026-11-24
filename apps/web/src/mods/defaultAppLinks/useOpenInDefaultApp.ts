import type { AtomCommandResult } from "@t3tools/client-runtime/state/runtime";
import {
  AuthOrchestrationOperateScope,
  type EditorId,
  type EnvironmentId,
} from "@t3tools/contracts";

import { canUseMarkdownFileShellActions } from "~/components/chat/MarkdownFileLink.logic";
import { useRemoteOpenResolution } from "~/remoteOpen";
import { useEnvironmentScope } from "~/state/session";
import { shellEnvironment } from "~/state/shell";
import { useAtomCommand } from "~/state/use-atom-command";

export type OpenInDefaultApp = (
  absolutePath: string,
) => Promise<AtomCommandResult<unknown, unknown>>;

// The file-manager launch without reveal runs `open <path>` on macOS, as a Finder double-click does.
export function useOpenInDefaultApp(
  environmentId: EnvironmentId | null,
  availableEditors: ReadonlyArray<EditorId>,
): OpenInDefaultApp | undefined {
  const canOperateHost = useEnvironmentScope(environmentId, AuthOrchestrationOperateScope);
  const remoteOpen = useRemoteOpenResolution(environmentId);
  const openInEditor = useAtomCommand(shellEnvironment.openInEditor, { reportFailure: false });
  if (
    environmentId === null ||
    !canOperateHost ||
    !availableEditors.includes("file-manager") ||
    !canUseMarkdownFileShellActions(environmentId, remoteOpen.state.mode, remoteOpen.isResolved)
  ) {
    return undefined;
  }
  return (absolutePath) =>
    openInEditor({ environmentId, input: { cwd: absolutePath, editor: "file-manager" } });
}
