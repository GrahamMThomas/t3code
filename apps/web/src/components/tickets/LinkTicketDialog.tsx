import { parseThreadTicketInput, type ScopedThreadRef } from "@t3tools/contracts";
import { useAtomValue } from "@effect/atom-react";
import { squashAtomCommandFailure } from "@t3tools/client-runtime/state/runtime";
import { Atom } from "effect/reactivity";
import { useRef, useState } from "react";

import { appAtomRegistry } from "~/rpc/atomRegistry";
import { threadEnvironment } from "~/state/threads";
import { useAtomCommand } from "~/state/use-atom-command";
import { Button } from "../ui/button";
import {
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogPanel,
  DialogPopup,
  DialogTitle,
} from "../ui/dialog";
import { Input } from "../ui/input";

// Host in chat to survive command palette dismissal.
const linkTicketDialogThreadAtom = Atom.make<ScopedThreadRef | null>(null).pipe(
  Atom.keepAlive,
  Atom.withLabel("tickets:link-dialog-thread"),
);

export function openLinkTicketDialog(threadRef: ScopedThreadRef): void {
  appAtomRegistry.set(linkTicketDialogThreadAtom, threadRef);
}

export function LinkTicketDialogHost() {
  const threadRef = useAtomValue(linkTicketDialogThreadAtom);
  if (threadRef === null) return null;
  return (
    <LinkTicketDialog
      threadRef={threadRef}
      onClose={() => appAtomRegistry.set(linkTicketDialogThreadAtom, null)}
    />
  );
}

function LinkTicketDialog({
  threadRef,
  onClose,
}: {
  readonly threadRef: ScopedThreadRef;
  readonly onClose: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [text, setText] = useState("");
  const [dirty, setDirty] = useState(false);
  const [pending, setPending] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const link = useAtomCommand(threadEnvironment.linkTicket, { reportFailure: false });
  const ticket = parseThreadTicketInput(text);

  const submit = async () => {
    setDirty(true);
    if (ticket === null) return;
    setSubmitError(null);
    setPending(true);
    const result = await link({
      environmentId: threadRef.environmentId,
      input: { threadId: threadRef.threadId, ticket, source: "manual" },
    });
    setPending(false);
    if (result._tag === "Failure") {
      const error = squashAtomCommandFailure(result);
      setSubmitError(error instanceof Error ? error.message : "Could not link the ticket.");
      return;
    }
    onClose();
  };

  const validation =
    dirty && ticket === null ? "Paste a Linear issue URL, or type a bd id like jax-145.1." : null;

  return (
    <Dialog open onOpenChange={(next) => (pending || next ? undefined : onClose())}>
      <DialogPopup className="max-w-xl" initialFocus={inputRef}>
        <DialogHeader>
          <DialogTitle>Link ticket</DialogTitle>
          <DialogDescription>
            Show a Linear issue or bd ticket on this thread in the sidebar.
          </DialogDescription>
        </DialogHeader>
        <DialogPanel>
          <Input
            ref={inputRef}
            placeholder="https://linear.app/acme/issue/NRX-412 or jax-145.1"
            value={text}
            onChange={(event) => {
              setDirty(true);
              setText(event.target.value);
            }}
            onKeyDown={(event) => {
              if (event.key !== "Enter") return;
              event.preventDefault();
              void submit();
            }}
          />
          {(validation ?? submitError) ? (
            <p className="text-destructive text-xs">{validation ?? submitError}</p>
          ) : null}
        </DialogPanel>
        <DialogFooter>
          <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={pending}>
            Cancel
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={() => void submit()}
            disabled={pending || ticket === null}
          >
            {pending ? "Linking..." : "Link"}
          </Button>
        </DialogFooter>
      </DialogPopup>
    </Dialog>
  );
}
