import * as Console from "effect/Console";
import * as Effect from "effect/Effect";
import { Argument, Command } from "effect/cli";

import { projectLocationFlags } from "../cli/config.ts";
import { decodeThreadId, reportThreadErrors, withThreadTools } from "../cli/thread.ts";
import { LinkPullRequestResult } from "../mcp/toolkits/pullRequests/tools.ts";

/**
 * `t3 thread link <thread> <url>`: link a pull request to a thread from outside T3, as
 * harbord does when Forgejo opens a PR. T3 links on its own only PRs an agent opens with
 * `gh pr create` or `glab mr create`; a PR opened any other way needs this.
 */
export const threadLinkCommand = Command.make("link", {
  ...projectLocationFlags,
  thread: Argument.String("thread").pipe(Argument.withDescription("Thread id.")),
  url: Argument.String("url").pipe(Argument.withDescription("Pull request URL.")),
}).pipe(
  Command.withDescription("Link a pull request to a thread."),
  Command.withHandler((flags) =>
    Effect.gen(function* () {
      const threadId = yield* decodeThreadId(flags.thread);
      yield* withThreadTools(
        flags,
        Effect.fn("cli.thread.link")(function* (tools) {
          const linked = yield* tools.call(
            "link_pull_request",
            { threadId, url: flags.url.trim() },
            LinkPullRequestResult,
          );
          yield* Console.log(linked.alreadyLinked ? "Already linked." : "Linked.");
        }),
      );
    }).pipe(reportThreadErrors),
  ),
);
