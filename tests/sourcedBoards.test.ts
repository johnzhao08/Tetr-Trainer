import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { cells } from "../src/core/board";
import { findLesson } from "../src/core/lessons";
import { PUZZLES } from "../src/core/puzzles";
import { STRUCTURES } from "../src/core/structures";

// Source diagrams exactly as drawn (top row first, piece letters kept). Each
// lesson start must be the diagram with only the guided pieces taken off, and
// each non-T ghost must cover exactly that piece's cells in the diagram.
type Source = { url: string; diagram: string[]; place: string[] };

const strip = (s: Source) =>
  s.diagram.map((r) => [...r].map((ch) => (ch === "." || s.place.includes(ch) ? "." : "X")).join(""));

const cellsOf = (s: Source, letter: string) => {
  const out: string[] = [];
  s.diagram.forEach((r, i) =>
    [...r].forEach((ch, x) => {
      if (ch === letter) out.push(`${x},${s.diagram.length - 1 - i}`);
    }),
  );
  return out.sort();
};

const TSPIN_TRIPLE = "https://four.lol/methods/tspin-triple";
const STSD = "https://four.lol/methods/stsd";
const TRIPLE_DOUBLE = "https://four.lol/methods/triple-double";
const WINTERNEBS = "https://winternebs.github.io/TETRIS-FAQ/tspin (Building overhangs)";

// lesson step -> its source
const SOURCES: Record<string, Source> = {
  "tst:build": { url: `${TSPIN_TRIPLE} diagram 1`, diagram: ["XLLL......", "XL........", "XXX.XXXXXX", "XXX..XXXXX", "XXX.XXXXXX"], place: ["L"] },
  "tst:practice": { url: `${TSPIN_TRIPLE} diagram 2`, diagram: [".J........", ".JJJ......", "XX........", "XXX.XXXXXX", "XXX..XXXXX", "XXX.XXXXXX"], place: ["J"] },
  // Diagram 15 page 3 ("Using S or Z"), decoded with .claude/research/fumen.py.
  "triple-double:build": {
    url: `${TRIPLE_DOUBLE}#using-s-or-z (diagram 15 page 3)`,
    diagram: ["..I....XXX", "XXI..LLXXX", "XXI...LXXX", "XXISS.LXXX", "XXSS..XXXX", "XXXXX.XXXX", "XXXX.XXXXX"],
    place: ["S", "I", "L"],
  },
  "stsd:build": { url: `${STSD} diagram 4`, diagram: ["..IIII....", "...XXXXXXX", "JJ.XXXXXXX", "J..XXXXXXX", "J..XXXXXXX"], place: ["J", "I"] },
  "overhangs:piece-I": { url: `${STSD} diagram 4, J drawn solid`, diagram: ["..IIII....", "...XXXXXXX", "JJ.XXXXXXX", "J..XXXXXXX", "J..XXXXXXX"], place: ["I"] },
  "overhangs:piece-Z": { url: `${STSD} diagram 3, J drawn solid`, diagram: ["..ZZ......", "...ZZ.....", "JJ.XXXXXXX", "J..XXXXXXX", "J..XXXXXXX"], place: ["Z"] },
  // Transcribed from the winterNebs images (grey stack, green S / blue J).
  "overhangs:piece-S": { url: `${WINTERNEBS} image 2 (imgur lZrASYB)`, diagram: [".....S....", ".....SS...", "XXX...SXXX", "XXXX.XXXXX"], place: ["S"] },
  "overhangs:piece-J": { url: `${WINTERNEBS} image 3 (imgur B2a40do)`, diagram: ["..........", ".....JJ...", ".....JXX..", ".....JXX..", "XXX...XXXX", "XXXX.XXXXX"], place: ["J"] },
  "overhangs:piece-L": { url: `${TSPIN_TRIPLE} diagram 1`, diagram: ["XLLL......", "XL........", "XXX.XXXXXX", "XXX..XXXXX", "XXX.XXXXXX"], place: ["L"] },
};

const step = (lessonId: string, stepId: string) => {
  const s = findLesson(lessonId)!.steps.find((x) => x.id === stepId)!;
  if (s.kind === "guided") return { rows: s.puzzle.position.rows, guides: s.guides };
  if (s.kind === "practice") return { rows: s.puzzles[0].position.rows, guides: s.puzzles[0].guide ?? [] };
  throw new Error("shape");
};

describe("sourced lesson boards", () => {
  it.each(Object.entries(SOURCES))("%s equals its diagram minus the guided pieces", (id, src) => {
    const [lessonId, stepId] = id.split(":");
    const { rows, guides } = step(lessonId, stepId);
    expect(rows, src.url).toEqual(strip(src));
    for (const letter of src.place) {
      const ghost = guides.find((g) => g.type === letter)!;
      expect(cells(ghost).map(([x, y]) => `${x},${y}`).sort(), `${src.url} ${letter}`).toEqual(cellsOf(src, letter));
    }
  });

  it("starts the ready-board lessons from the sourced fixtures", () => {
    // https://four.lol/methods/stsd diagram 0 and /methods/triple-double diagram 0.
    expect(step("stsd", "practice").rows).toEqual(["..XXXXXXXX", "...XXXXXXX", "XX.XXXXXXX", "X..XXXXXXX", "X..XXXXXXX"]);
    expect(step("triple-double", "practice").rows).toEqual(["XXXX..XXXX", "XXX...XXXX", "XXX.XXXXXX", "XXX..XXXXX", "XXX.XXXXXX", "XXXX.XXXXX"]);
  });

  it("offers an overhang for the five pieces that have a diagram", () => {
    expect(findLesson("overhangs")!.steps.filter((s) => s.kind === "guided").map((s) => s.id)).toEqual([
      "piece-I", "piece-J", "piece-L", "piece-S", "piece-Z",
    ]);
  });

  it("starts every structure puzzle from its structure's sourced fixture", () => {
    const ids = ["tsd", "tst", "stsd", "fractal", "imperial-cross", "triple-double"];
    for (const id of ids) {
      const puzzle = PUZZLES.find((p) => p.id === id);
      const structure = STRUCTURES.find((x) => x.id === id);
      expect(puzzle, `puzzle ${id}`).toBeDefined();
      expect(structure, `structure ${id}`).toBeDefined();
      expect(puzzle!.position.rows, id).toEqual(structure!.fixture);
    }
  });

  it("sources every other puzzle from the TETR.IO wiki, with a citation", () => {
    const ids = new Set(["tsd", "tst", "stsd", "fractal", "imperial-cross", "triple-double"]);
    const rest = PUZZLES.filter((p) => !ids.has(p.id));
    expect(rest.length).toBeGreaterThan(0);
    for (const p of rest) expect(p.id, p.id).toMatch(/^mini-[slzj]-(single|double)$/);
    expect(readFileSync("src/core/puzzles.ts", "utf8")).toContain("https://tetrio.wiki.gg/wiki/Spins");
  });
});
