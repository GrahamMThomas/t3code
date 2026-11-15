import { describe, expect, it } from "@effect/vitest";
import type { RepositoryIdentity } from "@t3tools/contracts";
import * as Effect from "effect/Effect";
import * as Option from "effect/Option";

import {
  buildRepositoryIdentity,
  parseRemoteFetchUrls,
} from "../project/RepositoryIdentityResolver.ts";
import {
  ExtraRemoteIdentities,
  extraIdentities,
  withExtraRemotes,
} from "./ExtraRemoteIdentities.ts";

const ROOT = "/repos/product-services";
const GITHUB = "git@github.com:abridgeai/product-services.git";
const FORGEJO = "http://localhost:3300/jax/product-services.git";

// `git remote -v` from a checkout with a GitHub origin and a local Forgejo review remote.
const REMOTE_OUTPUT = [
  `forgejo\t${FORGEJO} (fetch)`,
  `forgejo\t${FORGEJO} (push)`,
  `origin\t${GITHUB} (fetch)`,
  `origin\t${GITHUB} (push)`,
].join("\n");

const primary: RepositoryIdentity = buildRepositoryIdentity({
  remoteName: "origin",
  remoteUrl: GITHUB,
  originUrl: GITHUB,
  rootPath: ROOT,
});

describe("extraIdentities", () => {
  it("adds one identity per other remote and skips the primary's repository", () => {
    const extras = extraIdentities(primary, ROOT, parseRemoteFetchUrls(REMOTE_OUTPUT));
    expect(extras.map((identity) => identity.locator.remoteName)).toEqual(["forgejo"]);
    expect(extras[0]?.canonicalKey).toBe("localhost/jax/product-services");
    expect(extras[0]?.rootPath).toBe(ROOT);
  });

  it("adds nothing when every remote points at the primary's repository", () => {
    const mirror = `mirror\t${GITHUB} (fetch)\norigin\t${GITHUB} (fetch)`;
    expect(extraIdentities(primary, ROOT, parseRemoteFetchUrls(mirror))).toEqual([]);
  });
});

describe("withExtraRemotes", () => {
  const forgejo = extraIdentities(primary, ROOT, parseRemoteFetchUrls(REMOTE_OUTPUT));
  const service = ExtraRemoteIdentities.of({ forPrimary: () => Effect.succeed(forgejo) });
  const project = { id: "p1", repositoryIdentity: primary };

  it.effect("follows each project with a copy per extra identity", () =>
    Effect.gen(function* () {
      const expanded = yield* withExtraRemotes([project], Option.some(service));
      expect(expanded.map((entry) => [entry.id, entry.repositoryIdentity.canonicalKey])).toEqual([
        ["p1", "github.com/abridgeai/product-services"],
        ["p1", "localhost/jax/product-services"],
      ]);
    }),
  );

  it.effect("passes projects through when the service is absent", () =>
    Effect.gen(function* () {
      expect(yield* withExtraRemotes([project], Option.none())).toEqual([project]);
    }),
  );
});
