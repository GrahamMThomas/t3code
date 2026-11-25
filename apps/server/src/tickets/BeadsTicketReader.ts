import {
  BeadsTicketDetail,
  BeadsTicketReadError,
  type ReadBeadsTicketInput,
} from "@t3tools/contracts";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as PlatformError from "effect/PlatformError";
import * as Schema from "effect/Schema";

import * as ProcessRunner from "../processRunner.ts";

const isReadError = Schema.is(BeadsTicketReadError);

const decodeShowOutput = Schema.decodeUnknownOption(
  Schema.fromJsonString(Schema.Array(BeadsTicketDetail)),
);

export function parseBdShowOutput(input: {
  readonly id: string;
  readonly code: number | null;
  readonly stdout: string;
  readonly timedOut: boolean;
}): BeadsTicketDetail | BeadsTicketReadError {
  if (input.timedOut) {
    return new BeadsTicketReadError({ reason: "failed", message: "bd took too long to answer." });
  }
  // bd prints `{ "error": ... }` and exits 1 for an id it has never seen.
  if (input.code !== 0) {
    return new BeadsTicketReadError({
      reason: /no issues found/i.test(input.stdout) ? "not-found" : "failed",
      message: /no issues found/i.test(input.stdout)
        ? `bd has no ticket ${input.id}.`
        : `bd show exited with code ${input.code ?? "unknown"}.`,
    });
  }
  const decoded = decodeShowOutput(input.stdout);
  if (decoded._tag === "None") {
    return new BeadsTicketReadError({
      reason: "bad-output",
      message: "bd printed output T3 Code can't read.",
    });
  }
  return (
    decoded.value[0] ??
    new BeadsTicketReadError({ reason: "not-found", message: `bd has no ticket ${input.id}.` })
  );
}

const isCommandNotFound = (error: ProcessRunner.ProcessRunError) =>
  error._tag === "ProcessSpawnError" &&
  error.cause instanceof PlatformError.PlatformError &&
  error.cause.reason._tag === "NotFound";

export class BeadsTicketReader extends Context.Service<
  BeadsTicketReader,
  {
    readonly read: (
      input: ReadBeadsTicketInput,
      options: { readonly workspaceRoot: string | undefined },
    ) => Effect.Effect<BeadsTicketDetail, BeadsTicketReadError>;
  }
>()("t3/tickets/BeadsTicketReader") {}

const make = Effect.gen(function* () {
  const runner = yield* ProcessRunner.ProcessRunner;

  /** Runs in the thread's folder so bd finds BEADS_DIR or the repo's .beads/ as a shell would. */
  const read = Effect.fn("BeadsTicketReader.read")(function* (
    input: ReadBeadsTicketInput,
    options: { readonly workspaceRoot: string | undefined },
  ) {
    const cwd = options.workspaceRoot;
    if (cwd === undefined) {
      return yield* new BeadsTicketReadError({
        reason: "no-folder",
        message: "This thread has no project folder to run bd in.",
      });
    }
    const output = yield* runner
      .run({
        command: "bd",
        args: ["show", input.id, "--json", "--brief-deps"],
        cwd,
        timeout: "15 seconds",
        timeoutBehavior: "timedOutResult",
      })
      .pipe(
        Effect.mapError(
          (error) =>
            new BeadsTicketReadError(
              isCommandNotFound(error)
                ? { reason: "bd-missing", message: "bd isn't installed on this machine." }
                : { reason: "failed", message: "Could not run bd." },
            ),
        ),
      );
    const result = parseBdShowOutput({ id: input.id, ...output });
    return isReadError(result) ? yield* result : result;
  });

  return { read } satisfies BeadsTicketReader["Service"];
});

export const layer = Layer.effect(BeadsTicketReader, make);
