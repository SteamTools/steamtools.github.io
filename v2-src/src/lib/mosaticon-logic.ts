export type MosColorMode = 'lab' | 'rgb' | 'hsl';
export type MosTool = 'pen' | 'line' | 'rect' | 'circle' | 'fill' | 'move';

export interface EmoteColorEntry {
  name: string; // canonical lowercase/cleaned key without colons for lookup
  displayName: string; // :name: for export & display
  bytes: Uint8Array; // 42 bytes: [0..2]=1x1, [3..14]=2x2, [15..41]=3x3
}

const WHITE_REF_X = 0.95047;
const WHITE_REF_Y = 1.0;
const WHITE_REF_Z = 1.08883;

function srgbToLinear(c: number): number {
  const v = c / 255;
  return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
}

function labF(t: number): number {
  return t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116;
}

export function rgbToLab(r: number, g: number, b: number): [number, number, number] {
  const lr = srgbToLinear(r);
  const lg = srgbToLinear(g);
  const lb = srgbToLinear(b);

  const x = (0.4124564 * lr + 0.3575761 * lg + 0.1804375 * lb) / WHITE_REF_X;
  const y = (0.2126729 * lr + 0.7151522 * lg + 0.072175 * lb) / WHITE_REF_Y;
  const z = (0.0193339 * lr + 0.119192 * lg + 0.9503041 * lb) / WHITE_REF_Z;

  const fx = labF(x);
  const fy = labF(y);
  const fz = labF(z);

  const l = 116 * fy - 16;
  const a = 500 * (fx - fy);
  const bv = 200 * (fy - fz);
  return [l, a, bv];
}

export function rgbToHsl255(r: number, g: number, b: number): [number, number, number] {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  let h = 0;
  let s = 0;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case rn:
        h = (gn - bn) / d + (gn < bn ? 6 : 0);
        break;
      case gn:
        h = (bn - rn) / d + 2;
        break;
      default:
        h = (rn - gn) / d + 4;
        break;
    }
    h /= 6;
  }

  return [h * 255, s * 255, l * 255];
}

export function buildFeatureVector(
  bytes42: Uint8Array,
  quality: 1 | 2 | 3,
  mode: MosColorMode,
): Float32Array {
  const gridN = quality === 1 ? 1 : (quality === 2 ? 2 : 3);
  const cellCount = gridN * gridN;
  const startByte = quality === 1 ? 0 : (quality === 2 ? 3 : 15);
  const out = new Float32Array(cellCount * 3);

  for (let i = 0; i < cellCount; i += 1) {
    const o = startByte + i * 3;
    const r = bytes42[o] ?? 0;
    const g = bytes42[o + 1] ?? 0;
    const b = bytes42[o + 2] ?? 0;
    if (mode === 'rgb') {
      out[i * 3] = r;
      out[i * 3 + 1] = g;
      out[i * 3 + 2] = b;
    } else if (mode === 'hsl') {
      const [h, s, l] = rgbToHsl255(r, g, b);
      out[i * 3] = h;
      out[i * 3 + 1] = s;
      out[i * 3 + 2] = l;
    } else {
      const [l, a, bv] = rgbToLab(r, g, b);
      out[i * 3] = l;
      out[i * 3 + 1] = a;
      out[i * 3 + 2] = bv;
    }
  }
  return out;
}

export function decodeBase64ToBytes42(b64: string): Uint8Array | null {
  try {
    const clean = String(b64 || '').trim();
    if (!clean) return null;
    const bin = atob(clean);
    if (bin.length < 3) return null;
    const arr = new Uint8Array(42);
    for (let i = 0; i < Math.min(42, bin.length); i += 1) {
      arr[i] = bin.charCodeAt(i);
    }
    return arr;
  } catch {
    return null;
  }
}

export function encodeBytes42ToBase64(bytes: Uint8Array): string {
  let bin = '';
  for (let i = 0; i < bytes.length; i += 1) {
    bin += String.fromCharCode(bytes[i]);
  }
  return btoa(bin);
}

/**
 * Extracts a 42-byte color signature (1x1 + 2x2 + 3x3 RGB cells) from RGBA image pixels.
 * Semi-transparent pixels composite over Steam dark slate (#1b2128).
 */
export function extractRegionBytes42(
  rgba: Uint8ClampedArray,
  imgWidth: number,
  x0: number,
  y0: number,
  w: number,
  h: number,
): Uint8Array {
  const out = new Uint8Array(42);
  let writeIdx = 0;

  for (const gridN of [1, 2, 3] as const) {
    for (let gy = 0; gy < gridN; gy += 1) {
      const sy = y0 + Math.floor((gy * h) / gridN);
      const ey = y0 + Math.max(sy - y0 + 1, Math.floor(((gy + 1) * h) / gridN));
      for (let gx = 0; gx < gridN; gx += 1) {
        const sx = x0 + Math.floor((gx * w) / gridN);
        const ex = x0 + Math.max(sx - x0 + 1, Math.floor(((gx + 1) * w) / gridN));

        let rSum = 0;
        let gSum = 0;
        let bSum = 0;
        let count = 0;

        for (let py = sy; py < ey; py += 1) {
          for (let px = sx; px < ex; px += 1) {
            const p = (py * imgWidth + px) * 4;
            const alpha = (rgba[p + 3] ?? 255) / 255;
            const inv = 1 - alpha;
            rSum += rgba[p] * alpha + 27 * inv;
            gSum += rgba[p + 1] * alpha + 33 * inv;
            bSum += rgba[p + 2] * alpha + 40 * inv;
            count += 1;
          }
        }

        if (count > 0) {
          out[writeIdx] = Math.round(rSum / count);
          out[writeIdx + 1] = Math.round(gSum / count);
          out[writeIdx + 2] = Math.round(bSum / count);
        }
        writeIdx += 3;
      }
    }
  }

  return out;
}

interface KdPoint<T> {
  vec: Float32Array;
  item: T;
}

interface KdNode<T> {
  axis: number;
  point: KdPoint<T>;
  left: KdNode<T> | null;
  right: KdNode<T> | null;
}

export class KdTree<T> {
  private root: KdNode<T> | null;
  private dims: number;

  constructor(points: KdPoint<T>[], dims: number) {
    this.dims = dims;
    this.root = this.build(points.slice(), 0);
  }

  private build(points: KdPoint<T>[], depth: number): KdNode<T> | null {
    if (points.length === 0) return null;
    const axis = depth % this.dims;
    points.sort((a, b) => a.vec[axis] - b.vec[axis]);
    const mid = points.length >> 1;
    return {
      axis,
      point: points[mid],
      left: this.build(points.slice(0, mid), depth + 1),
      right: this.build(points.slice(mid + 1), depth + 1),
    };
  }

  nearest(target: Float32Array): T | null {
    if (!this.root) return null;
    let bestItem: T | null = null;
    let bestDistSq = Number.POSITIVE_INFINITY;

    const visit = (node: KdNode<T> | null) => {
      if (!node) return;
      const pv = node.point.vec;
      let distSq = 0;
      for (let i = 0; i < this.dims; i += 1) {
        const d = target[i] - pv[i];
        distSq += d * d;
      }
      if (distSq < bestDistSq) {
        bestDistSq = distSq;
        bestItem = node.point.item;
      }

      const diff = target[node.axis] - pv[node.axis];
      const nearChild = diff < 0 ? node.left : node.right;
      const farChild = diff < 0 ? node.right : node.left;

      visit(nearChild);
      if (diff * diff < bestDistSq) {
        visit(farChild);
      }
    };

    visit(this.root);
    return bestItem;
  }
}

export function generateMosaicFromRgba(opts: {
  rgba: Uint8ClampedArray;
  imgWidth: number;
  imgHeight: number;
  cols: number;
  rows: number;
  palette: EmoteColorEntry[];
  quality: 1 | 2 | 3;
  mode: MosColorMode;
}): string[] {
  const { rgba, imgWidth, imgHeight, cols, rows, palette, quality, mode } = opts;
  const total = cols * rows;
  if (palette.length === 0 || cols <= 0 || rows <= 0 || imgWidth <= 0 || imgHeight <= 0) {
    return new Array<string>(Math.max(0, total)).fill('');
  }

  const dims = quality === 1 ? 3 : (quality === 2 ? 12 : 27);
  const points = palette.map((item) => ({
    item,
    vec: buildFeatureVector(item.bytes, quality, mode),
  }));
  const tree = new KdTree(points, dims);

  const out = new Array<string>(total);
  for (let row = 0; row < rows; row += 1) {
    const y0 = Math.floor((row * imgHeight) / rows);
    const y1 = Math.max(y0 + 1, Math.floor(((row + 1) * imgHeight) / rows));
    for (let col = 0; col < cols; col += 1) {
      const x0 = Math.floor((col * imgWidth) / cols);
      const x1 = Math.max(x0 + 1, Math.floor(((col + 1) * imgWidth) / cols));
      const blockBytes = extractRegionBytes42(rgba, imgWidth, x0, y0, x1 - x0, y1 - y0);
      const qVec = buildFeatureVector(blockBytes, quality, mode);
      const match = tree.nearest(qVec);
      out[row * cols + col] = match ? match.displayName : '';
    }
  }
  return out;
}

export function paintCell(grid: string[], w: number, h: number, x: number, y: number, brush: string): string[] {
  if (x < 0 || y < 0 || x >= w || y >= h) return grid;
  const idx = y * w + x;
  if (grid[idx] === brush) return grid;
  const next = grid.slice();
  next[idx] = brush;
  return next;
}

export function paintLine(
  grid: string[],
  w: number,
  h: number,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  brush: string,
): string[] {
  const next = grid.slice();
  let cx = x0;
  let cy = y0;
  const dx = Math.abs(x1 - x0);
  const dy = Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let err = dx - dy;

  for (;;) {
    if (cx >= 0 && cy >= 0 && cx < w && cy < h) {
      next[cy * w + cx] = brush;
    }
    if (cx === x1 && cy === y1) break;
    const e2 = 2 * err;
    if (e2 > -dy) {
      err -= dy;
      cx += sx;
    }
    if (e2 < dx) {
      err += dx;
      cy += sy;
    }
  }
  return next;
}

export function paintRect(
  grid: string[],
  w: number,
  h: number,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  brush: string,
  filled = false,
): string[] {
  const minX = Math.max(0, Math.min(x0, x1));
  const maxX = Math.min(w - 1, Math.max(x0, x1));
  const minY = Math.max(0, Math.min(y0, y1));
  const maxY = Math.min(h - 1, Math.max(y0, y1));
  const next = grid.slice();

  for (let y = minY; y <= maxY; y += 1) {
    for (let x = minX; x <= maxX; x += 1) {
      if (filled || x === minX || x === maxX || y === minY || y === maxY) {
        next[y * w + x] = brush;
      }
    }
  }
  return next;
}

export function paintCircle(
  grid: string[],
  w: number,
  h: number,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  brush: string,
  filled = false,
): string[] {
  const minX = Math.min(x0, x1);
  const maxX = Math.max(x0, x1);
  const minY = Math.min(y0, y1);
  const maxY = Math.max(y0, y1);
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  const rx = Math.max(0.5, (maxX - minX) / 2);
  const ry = Math.max(0.5, (maxY - minY) / 2);
  const next = grid.slice();

  for (let y = Math.max(0, minY); y <= Math.min(h - 1, maxY); y += 1) {
    for (let x = Math.max(0, minX); x <= Math.min(w - 1, maxX); x += 1) {
      const nx = (x - cx) / rx;
      const ny = (y - cy) / ry;
      const dist = nx * nx + ny * ny;
      if (filled) {
        if (dist <= 1.05) next[y * w + x] = brush;
      } else if (dist <= 1.15 && dist >= 0.62) {
        next[y * w + x] = brush;
      }
    }
  }
  return next;
}

export function floodFillGrid(
  grid: string[],
  w: number,
  h: number,
  startX: number,
  startY: number,
  brush: string,
): string[] {
  if (startX < 0 || startY < 0 || startX >= w || startY >= h) return grid;
  const target = grid[startY * w + startX];
  if (target === brush) return grid;

  const next = grid.slice();
  const stack: number[] = [startX, startY];
  while (stack.length > 0) {
    const y = stack.pop()!;
    const x = stack.pop()!;
    const idx = y * w + x;
    if (next[idx] !== target) continue;
    next[idx] = brush;
    if (x > 0) stack.push(x - 1, y);
    if (x + 1 < w) stack.push(x + 1, y);
    if (y > 0) stack.push(x, y - 1);
    if (y + 1 < h) stack.push(x, y + 1);
  }
  return next;
}

export function shiftGrid(grid: string[], w: number, h: number, dx: number, dy: number): string[] {
  const next = new Array<string>(w * h).fill('');
  for (let y = 0; y < h; y += 1) {
    const sy = y - dy;
    if (sy < 0 || sy >= h) continue;
    for (let x = 0; x < w; x += 1) {
      const sx = x - dx;
      if (sx < 0 || sx >= w) continue;
      next[y * w + x] = grid[sy * w + sx] || '';
    }
  }
  return next;
}

export function flipGridHorizontal(grid: string[], w: number, h: number): string[] {
  const next = new Array<string>(w * h);
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      next[y * w + (w - 1 - x)] = grid[y * w + x] || '';
    }
  }
  return next;
}

export function flipGridVertical(grid: string[], w: number, h: number): string[] {
  const next = new Array<string>(w * h);
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      next[(h - 1 - y) * w + x] = grid[y * w + x] || '';
    }
  }
  return next;
}

export function resizeGrid(
  grid: string[],
  oldW: number,
  oldH: number,
  newW: number,
  newH: number,
): string[] {
  const next = new Array<string>(newW * newH).fill('');
  const copyW = Math.min(oldW, newW);
  const copyH = Math.min(oldH, newH);
  for (let y = 0; y < copyH; y += 1) {
    for (let x = 0; x < copyW; x += 1) {
      next[y * newW + x] = grid[y * oldW + x] || '';
    }
  }
  return next;
}

export function exportMosaicText(
  grid: string[],
  w: number,
  h: number,
  blankEmote: string,
): string {
  const lines: string[] = [];
  const blank = blankEmote.trim();
  for (let y = 0; y < h; y += 1) {
    let line = '';
    for (let x = 0; x < w; x += 1) {
      const cell = grid[y * w + x] || blank;
      line += cell;
    }
    lines.push(line);
  }
  return lines.join('\n');
}

export function parseImportedMosaic(rawText: string): {
  width: number;
  height: number;
  cells: string[];
  uniqueCleanNames: string[];
} {
  const lines = String(rawText || '')
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  const parsedRows: string[][] = [];
  const uniqueSet = new Set<string>();
  const tokenRegex = /[:ː]([^:ː\s]+)[:ː]/g;

  for (const line of lines) {
    const row: string[] = [];
    tokenRegex.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = tokenRegex.exec(line)) !== null) {
      const clean = m[1];
      const display = `:${clean}:`;
      row.push(display);
      uniqueSet.add(clean);
    }
    if (row.length > 0) parsedRows.push(row);
  }

  if (parsedRows.length === 0) {
    return { width: 0, height: 0, cells: [], uniqueCleanNames: [] };
  }

  const width = parsedRows.reduce((max, r) => Math.max(max, r.length), 0);
  const height = parsedRows.length;
  const cells = new Array<string>(width * height).fill('');
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < parsedRows[y].length; x += 1) {
      cells[y * width + x] = parsedRows[y][x];
    }
  }
  return {
    width,
    height,
    cells,
    uniqueCleanNames: Array.from(uniqueSet),
  };
}
