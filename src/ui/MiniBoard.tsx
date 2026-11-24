import { COLORS } from "./BoardCanvas";

// A small static board drawn from top-down text rows. Letters are piece
// colours, X is garbage, "*" is an outlined target cell, "." is empty.
export function MiniBoard({
  rows,
  label,
  className = "mini-board",
}: {
  rows: readonly string[];
  label?: string;
  className?: string;
}) {
  const width = Math.max(...rows.map((row) => row.length));
  const size = 20;
  return (
    <svg
      className={className}
      viewBox={`0 0 ${width * size} ${rows.length * size}`}
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      <rect
        className="preview-well"
        width={width * size}
        height={rows.length * size}
        rx="4"
      />
      {rows.flatMap((row, y) =>
        [...row].flatMap((cell, x) => {
          if (cell === ".") return [];
          const key = `${x}-${y}`;
          const common = {
            x: x * size + 1,
            y: y * size + 1,
            width: size - 2,
            height: size - 2,
            rx: 2,
          };
          if (cell === "*")
            return [<rect key={key} {...common} className="mini-target" />];
          // G marks "fill freely" cells in opener guides.
          const color = COLORS[(cell === "G" ? "X" : cell) as keyof typeof COLORS];
          return color ? [<rect key={key} {...common} fill={color} />] : [];
        }),
      )}
    </svg>
  );
}
