// 落点计算 —— 方位提示换算 + 无方位时的防重叠自动选点。
import type { PositionHint } from '@shared/commands';
import { getBounds, type Shape } from '../engine/shapes';

/** 方位提示 → 画布坐标。 */
export function positionToXY(pos: PositionHint | undefined, W: number, H: number): { x: number; y: number } {
  const fx: Record<string, number> = { left: 0.25, right: 0.75, center: 0.5 };
  const fy: Record<string, number> = { top: 0.25, bottom: 0.75, center: 0.5 };
  let x = 0.5;
  let y = 0.5;
  switch (pos) {
    case 'top': y = fy.top; break;
    case 'bottom': y = fy.bottom; break;
    case 'left': x = fx.left; break;
    case 'right': x = fx.right; break;
    case 'top-left': x = fx.left; y = fy.top; break;
    case 'top-right': x = fx.right; y = fy.top; break;
    case 'bottom-left': x = fx.left; y = fy.bottom; break;
    case 'bottom-right': x = fx.right; y = fy.bottom; break;
  }
  return { x: W * x, y: H * y };
}

const ANCHORS: Array<[number, number]> = [
  [0.5, 0.5], [0.27, 0.3], [0.73, 0.3], [0.27, 0.7], [0.73, 0.7],
  [0.5, 0.28], [0.5, 0.72], [0.27, 0.5], [0.73, 0.5],
];

/** 无方位时挑一个离现有图形最远的锚点，避免新图形堆在画布中心重叠。 */
export function autoPlace(shapes: Shape[], W: number, H: number): { x: number; y: number } {
  if (!shapes.length) return { x: W * 0.5, y: H * 0.5 };
  const centers = shapes.map((s) => {
    const b = getBounds(s);
    return { x: (b.minX + b.maxX) / 2, y: (b.minY + b.maxY) / 2 };
  });
  let best = { x: W * 0.5, y: H * 0.5 };
  let bestDist = -1;
  for (const [fx, fy] of ANCHORS) {
    const p = { x: W * fx, y: H * fy };
    let minD = Infinity;
    for (const c of centers) {
      const d = Math.hypot(p.x - c.x, p.y - c.y);
      if (d < minD) minD = d;
    }
    if (minD > bestDist) {
      bestDist = minD;
      best = p;
    }
  }
  return best;
}
