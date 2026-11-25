import { cells, move, project, rotate, spawn, WIDTH } from "./board";
import type { Board, Piece, Tetromino } from "./board";

// Running totals kept in GameState, so undo and restart restore them with the
// rest of the game.
export type SessionStats = {
  // Garbage lines sent by every clear (surge and all clear included).
  attack: number;
  // Incoming garbage lines cancelled by outgoing attack.
  cancelled: number;
  // Attack left after cancelling, i.e. lines actually sent.
  sent: number;
  // Accepted gameplay key presses, including hard drop and hold.
  keys: number;
  // Movement, rotation and soft-drop presses for the piece now in play.
  pieceKeys: number;
  // Presses beyond the fewest needed, summed over every locked piece.
  finesseFaults: number;
  // Locked pieces placed with no extra presses.
  cleanPieces: number;
  // Garbage rows cleared.
  garbageCleared: number;
  maxB2b: number;
  maxCombo: number;
  // B2B chains of 4 or more that broke and released a surge.
  surges: number;
  spins: { full: number; mini: number };
};

export function emptyStats(): SessionStats {
  return {
    attack: 0,
    cancelled: 0,
    sent: 0,
    keys: 0,
    pieceKeys: 0,
    finesseFaults: 0,
    cleanPieces: 0,
    garbageCleared: 0,
    maxB2b: 0,
    maxCombo: 0,
    surges: 0,
    spins: { full: 0, mini: 0 },
  };
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
// Convention: each tap and each DAS hold-to-wall counts as one press, and soft
// drop counts once as a drop to the floor. Partial-DAS releases and
// intermediate soft drops are not modelled. `origin` is the pose the piece
// started in (defaults to the spawn pose).
export function finesseOptimal(
  board: Board,
  type: Tetromino,
  landing: Piece,
  origin?: Piece,
): number | null {
  const goal = footprint(landing);
  const start = origin ?? spawn(type);
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
  app: number;
  // TETR.IO VS: (attack + garbage cleared) per second * 100.
  vs: number;
  kpp: number;
  // Share of locked pieces placed with no extra presses, 0-1.
  finesse: number;
  // Pieces per garbage line cleared; null before any garbage clears.
  piecesPerGarbage: number | null;
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
    app: perPiece(stats.attack),
    vs: perSecond(stats.attack + stats.garbageCleared) * 100,
    kpp: perPiece(stats.keys),
    finesse: pieces > 0 ? stats.cleanPieces / pieces : 1,
    piecesPerGarbage:
      stats.garbageCleared > 0 ? pieces / stats.garbageCleared : null,
  };
}

/** Pieces ahead (+) or behind (-) a steady target pace after `elapsedMs`. */
export function paceDelta(
  pieces: number,
  elapsedMs: number,
  targetPps: number,
): number {
  return pieces - (targetPps * elapsedMs) / 1000;
}
