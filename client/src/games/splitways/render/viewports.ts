/** Screen rectangle in CSS pixels, origin top-left (like the DOM). */
export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Split-screen layout: 1 player full screen, 2 players top/bottom, 3-4 players a 2x2 grid.
 * With 3 players the bottom-right cell is left free for the race overview panel.
 * `gap` is the dark seam between viewports.
 */
export function viewportLayout(count: number, width: number, height: number, gap: number): Rect[] {
  if (count <= 1) return [{ x: 0, y: 0, width, height }];
  const half = gap / 2;
  if (count === 2) {
    const h = height / 2 - half;
    return [
      { x: 0, y: 0, width, height: h },
      { x: 0, y: height / 2 + half, width, height: h },
    ];
  }
  const w = width / 2 - half;
  const h = height / 2 - half;
  const cells: Rect[] = [
    { x: 0, y: 0, width: w, height: h },
    { x: width / 2 + half, y: 0, width: w, height: h },
    { x: 0, y: height / 2 + half, width: w, height: h },
    { x: width / 2 + half, y: height / 2 + half, width: w, height: h },
  ];
  return cells.slice(0, Math.min(count, 4));
}

/** The free cell in a 3-player layout, used for the overview panel. */
export function overviewCell(width: number, height: number, gap: number): Rect {
  const half = gap / 2;
  return {
    x: width / 2 + half,
    y: height / 2 + half,
    width: width / 2 - half,
    height: height / 2 - half,
  };
}
