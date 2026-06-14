// 组合/语义绘图预设库 —— 把“笑脸/房子/太阳…”展开为一组绝对坐标的图元。
// 每个预设是 (cx, cy, S, color) => PresetSpec[]，由 CommandExecutor 交 engine.addMany 整组落地
// （单一撤销单元）。S=1≈240px 图；B=120*S 为基准单位。color==='' 用预设默认色，
// 否则只覆盖“主色部件”（头/盘/树冠/花瓣/身体/猫脸），眼睛与描边保持深色。

import type { Shape, ShapeType } from '../engine/shapes';

export type PresetSpec = { type: ShapeType; props: Partial<Shape> };
export type PresetFn = (cx: number, cy: number, S: number, color: string) => PresetSpec[];

const mk = (type: ShapeType, props: Partial<Shape>): PresetSpec => ({ type, props });

const face: PresetFn = (cx, cy, S, color) => {
  const B = 120 * S;
  const skin = color || '#e2b32f';
  return [
    mk('circle', { x: cx, y: cy, r: B, color: skin, fill: true }),
    mk('circle', { x: cx - 0.4 * B, y: cy - 0.3 * B, r: 0.12 * B, color: '#222222', fill: true }),
    mk('circle', { x: cx + 0.4 * B, y: cy - 0.3 * B, r: 0.12 * B, color: '#222222', fill: true }),
    mk('arc', { x: cx, y: cy + 0.15 * B, r: 0.5 * B, a0: 20, a1: 160, color: '#222222', strokeWidth: Math.max(2, 0.06 * B) }),
  ];
};

const house: PresetFn = (cx, cy, S, color) => {
  const B = 120 * S;
  const wall = color || '#9b6a3a';
  return [
    mk('rect', { x: cx, y: cy + 0.25 * B, w: 1.6 * B, h: 1.2 * B, color: wall, fill: true }),
    // 屋顶三角底边对齐屋身顶边（屋身顶 = cy-0.35B；三角高=size，底边 = 中心y+size/2）
    mk('triangle', { x: cx, y: cy - 1.2 * B, size: 1.8 * B, color: '#e23b3b', fill: true }),
    mk('rect', { x: cx, y: cy + 0.6 * B, w: 0.4 * B, h: 0.5 * B, color: '#6f4e37', fill: true }),
    mk('rect', { x: cx + 0.45 * B, y: cy + 0.05 * B, w: 0.35 * B, h: 0.35 * B, color: '#2f7be2', fill: true }),
  ];
};

const sun: PresetFn = (cx, cy, S, color) => {
  const B = 120 * S;
  const c = color || '#e2a72f';
  const rays: PresetSpec[] = [];
  for (let i = 0; i < 8; i++) {
    const a = (i * Math.PI) / 4;
    rays.push(
      mk('line', {
        x: cx + Math.cos(a) * 0.8 * B,
        y: cy + Math.sin(a) * 0.8 * B,
        x2: cx + Math.cos(a) * 1.15 * B,
        y2: cy + Math.sin(a) * 1.15 * B,
        color: c,
        strokeWidth: Math.max(2, 0.05 * B),
      }),
    );
  }
  return [mk('circle', { x: cx, y: cy, r: 0.6 * B, color: c, fill: true }), ...rays];
};

const tree: PresetFn = (cx, cy, S, color) => {
  const B = 120 * S;
  const leaf = color || '#2fae5a';
  return [
    mk('rect', { x: cx, y: cy + 0.7 * B, w: 0.3 * B, h: 0.9 * B, color: '#9b6a3a', fill: true }),
    mk('circle', { x: cx, y: cy - 0.1 * B, r: 0.8 * B, color: leaf, fill: true }),
  ];
};

const flower: PresetFn = (cx, cy, S, color) => {
  const B = 120 * S;
  const petal = color || '#ed74b0';
  const petals: PresetSpec[] = [];
  for (let i = 0; i < 5; i++) {
    const a = -Math.PI / 2 + (i * 2 * Math.PI) / 5;
    petals.push(
      mk('circle', { x: cx + Math.cos(a) * 0.55 * B, y: cy + Math.sin(a) * 0.55 * B, r: 0.35 * B, color: petal, fill: true }),
    );
  }
  return [
    mk('line', { x: cx, y: cy + 0.3 * B, x2: cx, y2: cy + 1.4 * B, color: '#2fae5a', strokeWidth: Math.max(3, 0.08 * B) }),
    ...petals,
    mk('circle', { x: cx, y: cy, r: 0.3 * B, color: '#e2b32f', fill: true }),
  ];
};

const snowman: PresetFn = (cx, cy, S, color) => {
  const B = 120 * S;
  const body = color || '#e8eef5';
  return [
    mk('circle', { x: cx, y: cy + 0.7 * B, r: 0.7 * B, color: body, fill: true }),
    mk('circle', { x: cx, y: cy - 0.1 * B, r: 0.5 * B, color: body, fill: true }),
    mk('circle', { x: cx, y: cy - 0.75 * B, r: 0.35 * B, color: body, fill: true }),
    mk('circle', { x: cx - 0.13 * B, y: cy - 0.82 * B, r: 0.05 * B, color: '#222222', fill: true }),
    mk('circle', { x: cx + 0.13 * B, y: cy - 0.82 * B, r: 0.05 * B, color: '#222222', fill: true }),
    mk('triangle', { x: cx, y: cy - 0.7 * B, size: 0.18 * B, color: '#e2812f', fill: true, rotation: 90 }),
  ];
};

const cat: PresetFn = (cx, cy, S, color) => {
  const B = 120 * S;
  const fur = color || '#e2a72f';
  return [
    mk('triangle', { x: cx - 0.45 * B, y: cy - 0.55 * B, size: 0.5 * B, color: fur, fill: true }),
    mk('triangle', { x: cx + 0.45 * B, y: cy - 0.55 * B, size: 0.5 * B, color: fur, fill: true }),
    mk('circle', { x: cx, y: cy, r: 0.7 * B, color: fur, fill: true }),
    mk('circle', { x: cx - 0.25 * B, y: cy - 0.05 * B, r: 0.08 * B, color: '#222222', fill: true }),
    mk('circle', { x: cx + 0.25 * B, y: cy - 0.05 * B, r: 0.08 * B, color: '#222222', fill: true }),
    mk('triangle', { x: cx, y: cy + 0.18 * B, size: 0.12 * B, color: '#e23b3b', fill: true, rotation: 180 }),
    mk('line', { x: cx - 0.2 * B, y: cy + 0.2 * B, x2: cx - 0.6 * B, y2: cy + 0.12 * B, color: '#222222', strokeWidth: Math.max(1, 0.02 * B) }),
    mk('line', { x: cx + 0.2 * B, y: cy + 0.2 * B, x2: cx + 0.6 * B, y2: cy + 0.12 * B, color: '#222222', strokeWidth: Math.max(1, 0.02 * B) }),
  ];
};

export const PRESETS: Record<string, PresetFn> = { face, house, sun, tree, flower, snowman, cat };
