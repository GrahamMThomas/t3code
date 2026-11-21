import * as NodeOS from "node:os";

import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Path from "effect/Path";
import * as Schedule from "effect/Schedule";
import * as Schema from "effect/Schema";
import { ChildProcess } from "effect/process";

/** A process of Graham's that lives as long as `vp run dev`, outside T3 itself. */
interface Sidecar {
  readonly name: string;
  readonly command: string;
  readonly script: string;
  readonly args: ReadonlyArray<string>;
  /** Files the sidecar cannot start without, besides its script. */
  readonly requires: ReadonlyArray<string>;
}

const sidecars = Effect.gen(function* () {
  const path = yield* Path.Path;
  const bootstrap = path.join(NodeOS.homedir(), "repos/system-bootstrap");
  const harbord: Sidecar = {
    name: "harbord",
    command: "python3",
    script: path.join(bootstrap, "agentic_workflow/harbord/harbord.py"),
    args: [],
    requires: [path.join(NodeOS.homedir(), ".ssh/forgejo-webhook-secret")],
  };
  const t3Sync: Sidecar = {
    name: "t3-sync",
    command: "python3",
    script: path.join(bootstrap, "t3/sync.py"),
    args: ["watch"],
    requires: [],
  };
  return [harbord, t3Sync];
});

const firstMissingFile = Effect.fn("Sidecars.firstMissingFile")(function* (
  files: ReadonlyArray<string>,
) {
  const fs = yield* FileSystem.FileSystem;
  for (const file of files) {
    const exists = yield* fs.exists(file).pipe(Effect.orElseSucceed(() => false));
    if (!exists) return file;
  }
  return undefined;
});

const installedSidecars = Effect.gen(function* () {
  const list = yield* sidecars;
  return yield* Effect.filter(list, (sidecar) =>
    Effect.gen(function* () {
      const missing = yield* firstMissingFile([sidecar.script, ...sidecar.requires]);
      if (missing === undefined) return true;
      yield* Effect.logInfo(`[dev-runner] sidecar ${sidecar.name} skipped: ${missing} not found`);
      return false;
    }),
  );
});

const RESTART_BACKOFF = Schedule.min([
  Schedule.exponential("1 second"),
  Schedule.spaced("30 seconds"),
]);

class SidecarExitedError extends Schema.TaggedError<SidecarExitedError>()("SidecarExitedError", {
  sidecar: Schema.String,
  exitCode: Schema.Number,
}) {}

// Through a shell so version-manager shims resolve as in a terminal; pyenv-win's are .bat files.
const shellCommand = (sidecar: Sidecar): string =>
  [sidecar.command, `"${sidecar.script}"`, ...sidecar.args].join(" ");

const runOnce = (sidecar: Sidecar, env: NodeJS.ProcessEnv) =>
  Effect.scoped(
    Effect.gen(function* () {
      const child = yield* ChildProcess.make(shellCommand(sidecar), [], {
        shell: true,
        stdin: "ignore",
        stdout: "inherit",
        stderr: "inherit",
        env,
        extendEnv: false,
        detached: false,
        forceKillAfter: "1500 millis",
      });
      const exitCode = yield* child.exitCode;
      return yield* new SidecarExitedError({ sidecar: sidecar.name, exitCode: Number(exitCode) });
    }),
  );

const supervise = (sidecar: Sidecar, env: NodeJS.ProcessEnv) =>
  runOnce(sidecar, env).pipe(
    Effect.tapError((error) =>
      Effect.logWarning(
        `[dev-runner] sidecar ${sidecar.name} stopped, restarting: ${error.message}`,
      ),
    ),
    Effect.retry(RESTART_BACKOFF),
  );

/** Runs every sidecar until the dev runner's scope closes, restarting each one that exits. */
export const runSidecars = (env: NodeJS.ProcessEnv) =>
  Effect.flatMap(installedSidecars, (list) =>
    Effect.forEach(list, (sidecar) => supervise(sidecar, env), {
      concurrency: "unbounded",
      discard: true,
    }),
  );
