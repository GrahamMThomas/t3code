import * as NodeOS from "node:os";

import * as Effect from "effect/Effect";
import * as Path from "effect/Path";
import * as Schedule from "effect/Schedule";
import * as Schema from "effect/Schema";
import { ChildProcess } from "effect/process";

/** A process of Graham's that lives as long as `vp run dev`, outside T3 itself. */
interface Sidecar {
  readonly name: string;
  readonly command: string;
  readonly args: ReadonlyArray<string>;
}

const sidecars = Effect.gen(function* () {
  const path = yield* Path.Path;
  const harbord: Sidecar = {
    name: "harbord",
    command: "python3",
    args: [
      path.join(NodeOS.homedir(), "repos/system-bootstrap/agentic_workflow/harbord/harbord.py"),
    ],
  };
  return [harbord];
});

const RESTART_BACKOFF = Schedule.min([
  Schedule.exponential("1 second"),
  Schedule.spaced("30 seconds"),
]);

class SidecarExitedError extends Schema.TaggedError<SidecarExitedError>()("SidecarExitedError", {
  sidecar: Schema.String,
  exitCode: Schema.Number,
}) {}

const runOnce = (sidecar: Sidecar, env: NodeJS.ProcessEnv) =>
  Effect.scoped(
    Effect.gen(function* () {
      const child = yield* ChildProcess.make(sidecar.command, [...sidecar.args], {
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
  Effect.flatMap(sidecars, (list) =>
    Effect.forEach(list, (sidecar) => supervise(sidecar, env), {
      concurrency: "unbounded",
      discard: true,
    }),
  );
