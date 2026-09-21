import { useEffect, useRef } from "react";
import { SHAPES, type Tetromino } from "../core/board";
import { COLORS, drawBlock } from "./BoardCanvas";

export function PiecePreview({
  type,
  muted = false,
}: {
  type: Tetromino | null;
  muted?: boolean;
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
      const height = width / 2;
      const ratio = window.devicePixelRatio || 1;
      canvas.width = Math.round(width * ratio);
      canvas.height = Math.round(height * ratio);
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      context.clearRect(0, 0, width, height);
      if (!type) return;
      const points = SHAPES[type][0];
      const minX = Math.min(...points.map(([x]) => x));
      const maxX = Math.max(...points.map(([x]) => x));
      const minY = Math.min(...points.map(([, y]) => y));
      const maxY = Math.max(...points.map(([, y]) => y));
      const size = width / 4;
      const offsetX = (width - (maxX - minX + 1) * size) / 2;
      const offsetY = (height - (maxY - minY + 1) * size) / 2;
      context.globalAlpha = muted ? 0.3 : 1;
      for (const [x, y] of points) {
        drawBlock(
          context,
          offsetX + (x - minX) * size,
          offsetY + (maxY - y) * size,
          size,
          COLORS[type],
        );
      }
    };
    draw();
    const observer = new ResizeObserver(draw);
    observer.observe(canvas);
    return () => observer.disconnect();
  }, [type, muted]);

  return (
    <canvas
      ref={canvasRef}
      role="img"
      aria-label={
        type
          ? `${type} piece${muted ? ", hold unavailable until next lock" : ""}`
          : "Empty hold"
      }
      style={{
        display: "block",
        width: "100%",
        height: "auto",
        aspectRatio: "2/1",
      }}
    />
  );
}
