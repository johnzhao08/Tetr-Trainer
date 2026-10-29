import { useEffect, useRef } from "react";
import {
  cells,
  project,
  VISIBLE,
  WIDTH,
  type Board,
  type Cell,
  type Piece,
} from "../core/board";

export const COLORS: Record<Exclude<Cell, null>, string> = {
  I: "#41cce3",
  J: "#5577ee",
  L: "#f3a349",
  O: "#efcf54",
  S: "#77cf83",
  T: "#b380e9",
  Z: "#ed7184",
  X: "#74818d",
  H: "#ef5350",
};

export function drawBlock(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  color: string,
) {
  const inset = Math.max(1, size * 0.035);
  context.fillStyle = color;
  context.fillRect(x + inset, y + inset, size - inset * 2, size - inset * 2);
  context.fillStyle = "#ffffff29";
  context.fillRect(
    x + inset,
    y + inset,
    size - inset * 2,
    Math.max(1, size * 0.08),
  );
  context.fillStyle = "#00000020";
  context.fillRect(
    x + inset,
    y + size * 0.83,
    size - inset * 2,
    size * 0.17 - inset,
  );
  context.strokeStyle = "#ffffff13";
  context.lineWidth = 1;
  context.strokeRect(
    x + size * 0.18,
    y + size * 0.18,
    size * 0.64,
    size * 0.64,
  );
}

const ROWS = VISIBLE + 3;

export function BoardCanvas({
  board,
  active,
  paused,
}: {
  board: Board;
  active: Piece | null;
  paused: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext("2d");
    if (!context) return;

    const draw = () => {
      const width = canvas.getBoundingClientRect().width;
      if (!width) return;
      const size = width / WIDTH;
      const height = ROWS * size;
      const ratio = window.devicePixelRatio || 1;
      canvas.width = Math.round(width * ratio);
      canvas.height = Math.round(height * ratio);
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      context.fillStyle = "#11151a";
      context.fillRect(0, 0, width, height);
      context.fillStyle = "#0c1014";
      context.fillRect(0, 0, width, 3 * size);

      context.strokeStyle = "#ffffff07";
      context.lineWidth = 1 / ratio;
      context.beginPath();
      for (let x = 1; x < WIDTH; x++) {
        context.moveTo(x * size, 0);
        context.lineTo(x * size, height);
      }
      for (let y = 1; y < ROWS; y++) {
        context.moveTo(0, y * size);
        context.lineTo(width, y * size);
      }
      context.stroke();

      for (let y = 0; y < ROWS; y++) {
        for (let x = 0; x < WIDTH; x++) {
          const cell = board[y]?.[x];
          if (!cell) continue;
          context.globalAlpha = y >= VISIBLE ? 0.55 : 1;
          drawBlock(
            context,
            x * size,
            (ROWS - 1 - y) * size,
            size,
            COLORS[cell],
          );
        }
      }
      context.globalAlpha = 1;

      if (active) {
        const ghost = project(board, active);
        for (const [x, y] of cells(ghost)) {
          if (x < 0 || x >= WIDTH || y < 0 || y >= ROWS) continue;
          const top = (ROWS - 1 - y) * size;
          context.globalAlpha = 0.1;
          context.fillStyle = COLORS[active.type];
          context.fillRect(x * size + 2, top + 2, size - 4, size - 4);
          context.globalAlpha = 0.45;
          context.strokeStyle = COLORS[active.type];
          context.lineWidth = 1;
          context.strokeRect(x * size + 2, top + 2, size - 4, size - 4);
        }
        context.globalAlpha = 1;
        for (const [x, y] of cells(active)) {
          if (x < 0 || x >= WIDTH || y < 0 || y >= ROWS) continue;
          drawBlock(
            context,
            x * size,
            (ROWS - 1 - y) * size,
            size,
            COLORS[active.type],
          );
        }
      }

      context.strokeStyle = "#9aa7b332";
      context.lineWidth = 1;
      context.setLineDash([3, 5]);
      context.beginPath();
      context.moveTo(0, 3 * size);
      context.lineTo(width, 3 * size);
      context.stroke();
      context.setLineDash([]);
      if (paused) {
        context.fillStyle = "#0c1014aa";
        context.fillRect(0, 0, width, height);
      }
    };

    draw();
    const observer = new ResizeObserver(draw);
    observer.observe(canvas);
    window.addEventListener("resize", draw);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", draw);
    };
  }, [board, active, paused]);

  return (
    <canvas
      ref={canvasRef}
      className="board-canvas"
      role="img"
      aria-label={`Free-play board, 10 columns and 20 rows.${active ? ` Active piece: ${active.type}.` : ""}${paused ? " Paused." : ""}`}
      style={{
        display: "block",
        width: "100%",
        height: "auto",
        aspectRatio: `${WIDTH}/${ROWS}`,
      }}
    />
  );
}
