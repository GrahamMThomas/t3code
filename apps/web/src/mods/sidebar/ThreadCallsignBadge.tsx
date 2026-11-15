import type { ThreadId } from "@t3tools/contracts";

import { identicon, threadCallsign } from "./callsign";

const SIZE_PX = 24;

/** The thread's fixed mark: its identicon, with the callsign under it. */
export function ThreadCallsignBadge(props: { threadId: ThreadId }) {
  const callsign = threadCallsign(props.threadId);
  const { pixels, primary, secondary, text } = identicon(callsign);
  const fill = [undefined, primary, secondary] as const;
  return (
    <span className="flex w-11 shrink-0 flex-col items-center gap-0.5">
      <svg
        width={SIZE_PX}
        height={SIZE_PX}
        viewBox="-0.5 -0.5 6 6"
        shapeRendering="crispEdges"
        style={{ filter: `drop-shadow(0 0 3px ${primary})` }}
        aria-hidden
      >
        <rect x={-0.5} y={-0.5} width={6} height={6} fill="var(--color-background)" />
        {pixels.map((pixel) => (
          <rect
            key={`${pixel.x}-${pixel.y}`}
            x={pixel.x}
            y={pixel.y}
            width={1}
            height={1}
            fill={fill[pixel.tone]}
          />
        ))}
      </svg>
      <span className="font-mono text-4xs tracking-widest" style={{ color: text }}>
        {callsign}
      </span>
    </span>
  );
}
