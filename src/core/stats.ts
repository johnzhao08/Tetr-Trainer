import { cells, move, project, rotate, spawn, WIDTH } from "./board";
import type { Board, Piece, Tetromino } from "./board";

// Running totals kept in GameState, so undo and restart restore them with the
// rest of the game.
export type SessionStats = {
  // Lines of garbage the clears would send (TETR.IO-style attack table).
  attack: number;
  // Accepted gameplay key presses, including hard drop and hold.
  keys: number;
  // Movement, rotation and soft-drop presses for the piece now in play.
  pieceKeys: number;
  // Presses beyond the fewest needed, summed over every locked piece.
  finesseFaults: number;
  // Locked pieces placed with no extra presses.
  cleanPieces: number;
};

export function emptyStats(): SessionStats {
  return {
    attack: 0,
    keys: 0,
    pieceKeys: 0,
    finesseFaults: 0,
    cleanPieces: 0,
  };
}

// TETR.IO's classic multiplier table: base lines by clear, B2B chaining bonus,
// combo multiplier with the log floor for small clears, and a flat all-clear.
const BASE = {
  none: [0, 0, 1, 2, 4],
  mini: [0, 0, 1, 2, 4],
  full: [0, 2, 4, 6, 10],
};
const B2B_LOG = 0.8;
const COMBO_BONUS = 0.25;
const COMBO_LOG = 1.25;
export const ALL_CLEAR_ATTACK = 10;

export function attackFor({
  lines,
  spin,
  b2b,
  combo,
  allClear,
}: {
  lines: number;
  spin: "full" | "mini" | null;
  // Chain counts after this clear, as GameState stores them: the second
  // qualifying clear in a row is b2b 1, the second clear in a row is combo 1.
  b2b: number;
  combo: number;
  allClear: boolean;
}): number {
  if (lines <= 0) return 0;
  let attack = BASE[spin ?? "none"][Math.min(lines, 4)];
  if (b2b > 0) {
    const log = Math.log1p(b2b * B2B_LOG);
    attack += Math.floor(1 + log) + (b2b === 1 ? 0 : (1 + (log % 1)) / 3);
  }
  if (combo > 0) {
    attack *= 1 + COMBO_BONUS * combo;
    if (combo > 1) attack = Math.max(Math.log1p(COMBO_LOG * combo), attack);
  }
  return Math.floor(attack) + (allClear ? ALL_CLEAR_ATTACK : 0);
}

const footprint = (piece: Piece) =>
  cells(piece)
    .map(([x, y]) => y * WIDTH + x)
    .sort((a, b) => a - b)
    .join(",");

// Fewest presses that bring a freshly spawned piece to `landing`'s cells:
// taps, held moves to the wall, the three rotations and soft drop each count
// as one press; the hard drop itself is not counted. Searching the real board
// means tucks and spins are measured against their own shortest route.
export function finesseOptimal(
  board: Board,
  type: Tetromino,
  landing: Piece,
): number | null {
  const goal = footprint(landing);
  const start = spawn(type);
  const id = (p: Piece) => `${p.x},${p.y},${p.rotation}`;
  const seen = new Set([id(start)]);
  let frontier = [start];
  for (let presses = 0; frontier.length; presses++) {
    const next: Piece[] = [];
    for (const piece of frontier) {
      if (footprint(project(board, piece)) === goal) return presses;
      const slide = (dx: number) => {
        let p = piece;
        for (let q = move(board, p, dx, 0); q !== p; q = move(board, q, dx, 0))
          p = q;
        return p;
      };
      for (const candidate of [
        move(board, piece, -1, 0),
        move(board, piece, 1, 0),
        slide(-1),
        slide(1),
        rotate(board, piece, 1),
        rotate(board, piece, -1),
        rotate(board, piece, 2),
        project(board, piece),
      ]) {
        if (seen.has(id(candidate))) continue;
        seen.add(id(candidate));
        next.push(candidate);
      }
    }
    frontier = next;
  }
  return null;
}

export type CompetitiveMetrics = {
  apm: number;
  pps: number;
  vs: number;
  app: number;
  kpp: number;
  // Share of locked pieces placed with no extra presses, 0-100.
  finesse: number;
  faults: number;
  attack: number;
};

export function competitiveMetrics(
  stats: SessionStats,
  pieces: number,
  elapsedMs: number,
): CompetitiveMetrics {
  const seconds = elapsedMs / 1000;
  const perSecond = (n: number) => (seconds > 0 ? n / seconds : 0);
  const perPiece = (n: number) => (pieces > 0 ? n / pieces : 0);
  return {
    apm: perSecond(stats.attack) * 60,
    pps: perSecond(pieces),
    // TETR.IO VS adds garbage cleared to attack; freeplay has no garbage.
    vs: perSecond(stats.attack) * 100,
    app: perPiece(stats.attack),
    kpp: perPiece(stats.keys),
    finesse: pieces > 0 ? (stats.cleanPieces / pieces) * 100 : 100,
    faults: stats.finesseFaults,
    attack: stats.attack,
  };
}
