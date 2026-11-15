import type { ThreadId } from "@t3tools/contracts";

import { CALLSIGN_WORDS } from "./callsignWords";

/** 0 is empty, 1 is the primary color, 2 the secondary. */
export type IdenticonCell = 0 | 1 | 2;

export interface IdenticonPixel {
  readonly x: number;
  readonly y: number;
  readonly tone: Exclude<IdenticonCell, 0>;
}

export interface Identicon {
  readonly cells: ReadonlyArray<ReadonlyArray<IdenticonCell>>;
  /** The filled cells, for drawing. */
  readonly pixels: ReadonlyArray<IdenticonPixel>;
  readonly primary: string;
  readonly secondary: string;
  /** The primary hue, light enough to read as small text on the sidebar. */
  readonly text: string;
}

const SIZE = 5;
const HALF = Math.ceil(SIZE / 2);
const HUE_OFFSET = 140;

/** A word picked by the thread id, so a thread keeps its callsign without stored state. */
export function threadCallsign(threadId: ThreadId): string {
  return CALLSIGN_WORDS[hash(threadId) % CALLSIGN_WORDS.length] ?? "UNNAMED";
}

/** A 5×5 grid, mirrored on the middle column, in two colors. A pure function of the callsign. */
export function identicon(callsign: string): Identicon {
  const hue = hash(callsign) % 360;
  const cells = Array.from({ length: SIZE }, (_, y) => {
    const left = Array.from({ length: HALF }, (_, x) => cell(callsign, y * HALF + x));
    return [...left, ...left.slice(0, SIZE - HALF).reverse()];
  });
  const pixels = cells.flatMap((row, y) =>
    row.flatMap((tone, x) => (tone === 0 ? [] : [{ x, y, tone }])),
  );
  return {
    cells,
    pixels,
    primary: `hsl(${hue} 85% 62%)`,
    secondary: `hsl(${(hue + HUE_OFFSET) % 360} 80% 55%)`,
    text: `hsl(${hue} 85% 72%)`,
  };
}

function cell(callsign: string, index: number): IdenticonCell {
  const value = hash(`${callsign}:${index}`) % 3;
  return value === 0 ? 0 : value === 1 ? 1 : 2;
}

/** FNV-1a, 32-bit. */
function hash(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
