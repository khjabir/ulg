/**
 * The grid cell under a pointer, worked out from the grid's box rather than from
 * whatever element happens to be under the finger. Points outside the grid snap to
 * the nearest edge cell, so a drag that overshoots the board still reaches the edge
 * row or column. Points further than `reach` cells outside return null.
 */
export function cellFromPoint(
  grid: HTMLElement,
  x: number,
  y: number,
  rows: number,
  cols: number,
  reach = 1.5,
): number | null {
  const box = grid.getBoundingClientRect();
  const left = box.left + grid.clientLeft;
  const top = box.top + grid.clientTop;
  const width = grid.clientWidth || box.width;
  const height = grid.clientHeight || box.height;
  const cw = width / cols;
  const ch = height / rows;
  if (x < left - reach * cw || x > left + width + reach * cw || y < top - reach * ch || y > top + height + reach * ch) {
    return null;
  }
  const c = Math.min(cols - 1, Math.max(0, Math.floor((x - left) / cw)));
  const r = Math.min(rows - 1, Math.max(0, Math.floor((y - top) / ch)));
  return r * cols + c;
}
