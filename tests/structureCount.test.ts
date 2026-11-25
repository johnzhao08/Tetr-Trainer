import { describe, expect, it } from "vitest";
import { emptyBoard } from "../src/core/board";
import { countStructure, STRUCTURE_WINDOW } from "../src/core/structureCount";
import type { StructureHit, StructureKind } from "../src/core/structureCount";
import { findPlacements } from "../src/core/spins";
import { boardOf, chainSearch, STRUCTURES } from "../src/core/structures";

const hit = (
  index: number,
  type: StructureHit["type"],
  landing: StructureHit["landing"],
  cleared: number,
  before: StructureHit["before"],
  spin: StructureHit["spin"] = "full",
): StructureHit => ({ index, type, landing, cleared, before, spin });

/** The structure's own fixture played out: its T-spins, plus the quad for Kaidan. */
function use(kind: StructureKind): StructureHit[] {
  const s = STRUCTURES.find((x) => x.id === kind)!;
  const start = boardOf(s);
  const want = s.chain.map((c) => c.lines).join();
  const c = chainSearch(start, s.chain.length).find(
    (x) => x.spins.map((y) => y.lines).join() === want && x.spins.every((y) => y.spin === "full"),
  )!;
  const hits = c.moves.map((m, i) => hit(i * 2, "T", m.piece, m.lines, i ? c.moves[i - 1].after : start));
  if (kind === "kaidan") {
    const quad = findPlacements(c.board, "I").find((q) => q.lines === 4)!;
    hits.push(hit(5, "I", quad.piece, 4, c.board, null));
  }
  return hits;
}
const KINDS: StructureKind[] = ["kaidan", "stsd", "triple-double", "fractal", "imperial-cross"];

describe("countStructure", () => {
  it("counts full T-spin triples for tst, nothing else", () => {
    const t = (i: number, n: number, spin: StructureHit["spin"] = "full") =>
      hit(i, "T", { type: "T", x: 0, y: 0, rotation: 0 }, n, emptyBoard(), spin);
    expect(countStructure([t(0, 3), t(5, 2), t(9, 3), t(10, 3, "mini")], "tst")).toBe(2);
  });
  it.each(KINDS)("counts the real %s once", (kind) => {
    expect(countStructure(use(kind), kind)).toBe(1);
    expect(countStructure([...use(kind), ...use(kind).map((h) => ({ ...h, index: h.index + 20 }))], kind)).toBe(2);
  });
  it("does not credit one structure's spins to another", () => {
    for (const a of KINDS) for (const b of KINDS) if (a !== b) expect(countStructure(use(a), b), `${a} as ${b}`).toBe(0);
  });
  it("needs the cue on the board before the first spin", () => {
    for (const kind of KINDS) {
      const bare = use(kind).map((h) => ({ ...h, before: emptyBoard() }));
      expect(countStructure(bare, kind), kind).toBe(0);
    }
  });
  it("needs the follow-up to land in the cue's columns", () => {
    for (const kind of KINDS) {
      const u = use(kind);
      const far = { ...u[u.length - 1], landing: { type: u[u.length - 1].type, x: kind === "kaidan" ? 0 : 20, y: 1, rotation: 1 as const } };
      expect(countStructure([...u.slice(0, -1), far], kind), kind).toBe(0);
    }
  });
  it("needs the follow-up within the window", () => {
    const u = use("fractal");
    const late = { ...u[1], index: u[0].index + STRUCTURE_WINDOW + 1 };
    expect(countStructure([u[0], late], "fractal")).toBe(0);
  });
});
