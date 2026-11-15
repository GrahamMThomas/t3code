import type { RepositoryIdentity } from "@t3tools/contracts";
import * as Cache from "effect/Cache";
import * as Context from "effect/Context";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";

import * as ProcessRunner from "../processRunner.ts";
import {
  buildRepositoryIdentity,
  gitEnv,
  parseRemoteFetchUrls,
} from "../project/RepositoryIdentityResolver.ts";
import { sourceControlDefinitions } from "../sourceControl/sourceControlDefinitions.ts";
import * as HostProcess from "@t3tools/shared/HostProcess";

const CACHE_CAPACITY = 512;
// Matches RepositoryIdentityResolver: PR sweeps run every minute and need cached hits.
const CACHE_TTL = Duration.minutes(15);

/**
 * A project's identities for its other remotes, beside the one RepositoryIdentityResolver picks.
 * T3 gives a project one code host, from its primary remote. With these, a checkout whose `origin`
 * is GitHub can also follow pull requests on a second remote, such as a local Forgejo.
 */
export class ExtraRemoteIdentities extends Context.Service<
  ExtraRemoteIdentities,
  {
    readonly forPrimary: (
      primary: RepositoryIdentity,
    ) => Effect.Effect<ReadonlyArray<RepositoryIdentity>>;
  }
>()("t3/mods/ExtraRemoteIdentities") {}

const remotesOf = Effect.fn("ExtraRemoteIdentities.remotesOf")(function* (rootPath: string) {
  const processRunner = yield* ProcessRunner.ProcessRunner;
  const result = yield* processRunner
    .run({
      command: "git",
      args: ["-C", rootPath, "remote", "-v"],
      env: gitEnv(yield* HostProcess.Platform),
      timeoutBehavior: "timedOutResult",
    })
    .pipe(Effect.option);
  if (result._tag === "None" || result.value.timedOut || result.value.code !== 0) {
    return new Map<string, string>();
  }
  return parseRemoteFetchUrls(result.value.stdout);
});

/** One identity per recognized remote whose repository differs from the primary one. */
export function extraIdentities(
  primary: RepositoryIdentity,
  rootPath: string,
  remotes: ReadonlyMap<string, string>,
): ReadonlyArray<RepositoryIdentity> {
  const seen = new Set([primary.canonicalKey]);
  const extras: RepositoryIdentity[] = [];
  for (const [remoteName, remoteUrl] of remotes) {
    if (sourceControlDefinitions.recognizeRemote(remoteUrl) === null) continue;
    const identity = buildRepositoryIdentity({
      remoteName,
      remoteUrl,
      originUrl: remotes.get("origin"),
      rootPath,
    });
    if (seen.has(identity.canonicalKey)) continue;
    seen.add(identity.canonicalKey);
    extras.push(identity);
  }
  return extras;
}

/**
 * Each project, then a copy of it per extra remote identity, so every PR lookup sees the
 * second remote as its own repository. Without the service, projects pass through unchanged.
 */
export const withExtraRemotes = <
  P extends { readonly repositoryIdentity?: RepositoryIdentity | null | undefined },
>(
  projects: ReadonlyArray<P>,
  service: Option.Option<ExtraRemoteIdentities["Service"]>,
): Effect.Effect<Array<P>> =>
  Option.match(service, {
    onNone: () => Effect.succeed([...projects]),
    onSome: (extras) =>
      Effect.forEach(projects, (project) =>
        project.repositoryIdentity == null
          ? Effect.succeed([project])
          : extras
              .forPrimary(project.repositoryIdentity)
              .pipe(
                Effect.map((identities) => [
                  project,
                  ...identities.map((repositoryIdentity) => ({ ...project, repositoryIdentity })),
                ]),
              ),
      ).pipe(Effect.map((groups) => groups.flat())),
  });

const make = Effect.fn("ExtraRemoteIdentities.make")(function* () {
  const processRunner = yield* ProcessRunner.ProcessRunner;
  const remotesCache = yield* Cache.makeWith<string, ReadonlyMap<string, string>>(
    (rootPath) =>
      remotesOf(rootPath).pipe(Effect.provideService(ProcessRunner.ProcessRunner, processRunner)),
    { capacity: CACHE_CAPACITY, timeToLive: () => CACHE_TTL },
  );
  const forPrimary = Effect.fn("ExtraRemoteIdentities.forPrimary")(function* (
    primary: RepositoryIdentity,
  ) {
    const rootPath = primary.rootPath;
    if (rootPath === undefined) return [];
    return extraIdentities(primary, rootPath, yield* Cache.get(remotesCache, rootPath));
  });
  return ExtraRemoteIdentities.of({ forPrimary });
});

export const layer = Layer.effect(ExtraRemoteIdentities, make()).pipe(
  Layer.provide(ProcessRunner.layer),
);
