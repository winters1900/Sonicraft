// 图形对象模型 —— 引擎与渲染共用的最小数据结构。
// 所有图形共享位置/颜色/描边等基础属性，再按类型携带专属字段。

export type ShapeType =
  | 'circle' | 'rect' | 'line' | 'arrow' | 'triangle' | 'text'
  | 'ellipse' | 'polygon' | 'star' | 'heart' | 'arc' | 'image';

export interface Shape {
  id: string;
  type: ShapeType;
  /** 锚点：圆/矩形/三角/文字为中心点；线/箭头为起点。 */
  x: number;
  y: number;
  /** 主色（描边色，文字为字色）。CSS 颜色字符串。 */
  color: string;
  /** 是否填充（对圆/矩形/三角生效）。 */
  fill: boolean;
  /** 描边宽度（px）。 */
  strokeWidth: number;
  /** 旋转角度（度，绕锚点）。 */
  rotation: number;

  // —— 类型专属字段 ——
  r?: number; // circle/polygon/star/arc 半径（外接半径）
  w?: number; // rect/ellipse 宽
  h?: number; // rect/ellipse 高
  x2?: number; // line/arrow 终点
  y2?: number;
  size?: number; // triangle/heart 外接尺寸
  text?: string; // text 内容
  fontSize?: number; // text 字号
  sides?: number; // polygon 边数
  points?: number; // star 角数
  a0?: number; // arc 起始角（度）
  a1?: number; // arc 终止角（度）
  src?: string; // image 的图片数据(dataURL)，由 AI 文生图生成

  // —— 组合/语义绘图分组 ——
  /** 同一次 compose 产出的图元共享此 id，使“房子/笑脸”可作为整体重选与变换。 */
  groupId?: string;
  /** 组的语义类型（预设名，如 'house'），用于“选中房子”这类按名重选。 */
  groupKind?: string;
}

/** 各类型的默认尺寸/样式，便于“画一个圆”这类无参指令补全。 */
export const SHAPE_DEFAULTS = {
  color: '#222222',
  fill: false,
  strokeWidth: 2,
  rotation: 0,
  circleR: 60,
  rectW: 140,
  rectH: 90,
  lineLen: 140,
  triangleSize: 130,
  fontSize: 32,
  ellipseW: 160,
  ellipseH: 110,
  polygonR: 70,
  polygonSides: 6,
  starR: 75,
  starPoints: 5,
  heartSize: 130,
  arcR: 60,
  imageW: 240,
  imageH: 240,
} as const;

let idSeq = 0;
/** 生成稳定递增的图形 id（便于“最后一个/第 N 个”等指代）。 */
export function nextShapeId(): string {
  idSeq += 1;
  return `s${idSeq}`;
}

let groupSeq = 0;
/** 生成稳定递增的分组 id（一次 compose 一个）。 */
export function nextGroupId(): string {
  groupSeq += 1;
  return `g${groupSeq}`;
}

/** 仅供测试重置 id 序列。 */
export function __resetIdSeq(): void {
  idSeq = 0;
  groupSeq = 0;
}

/** 图形的轴对齐包围盒（忽略旋转，足够用于布局与命中粗判）。 */
export interface Bounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export function getBounds(s: Shape): Bounds {
  switch (s.type) {
    case 'circle': {
      const r = s.r ?? SHAPE_DEFAULTS.circleR;
      return { minX: s.x - r, minY: s.y - r, maxX: s.x + r, maxY: s.y + r };
    }
    case 'rect': {
      const w = s.w ?? SHAPE_DEFAULTS.rectW;
      const h = s.h ?? SHAPE_DEFAULTS.rectH;
      return { minX: s.x - w / 2, minY: s.y - h / 2, maxX: s.x + w / 2, maxY: s.y + h / 2 };
    }
    case 'triangle': {
      const sz = s.size ?? SHAPE_DEFAULTS.triangleSize;
      return { minX: s.x - sz / 2, minY: s.y - sz / 2, maxX: s.x + sz / 2, maxY: s.y + sz / 2 };
    }
    case 'text': {
      const fs = s.fontSize ?? SHAPE_DEFAULTS.fontSize;
      const w = (s.text?.length ?? 1) * fs * 0.6;
      return { minX: s.x - w / 2, minY: s.y - fs / 2, maxX: s.x + w / 2, maxY: s.y + fs / 2 };
    }
    case 'line':
    case 'arrow': {
      const x2 = s.x2 ?? s.x + SHAPE_DEFAULTS.lineLen;
      const y2 = s.y2 ?? s.y;
      return {
        minX: Math.min(s.x, x2),
        minY: Math.min(s.y, y2),
        maxX: Math.max(s.x, x2),
        maxY: Math.max(s.y, y2),
      };
    }
    case 'ellipse': {
      const w = s.w ?? SHAPE_DEFAULTS.ellipseW;
      const h = s.h ?? SHAPE_DEFAULTS.ellipseH;
      return { minX: s.x - w / 2, minY: s.y - h / 2, maxX: s.x + w / 2, maxY: s.y + h / 2 };
    }
    case 'polygon':
    case 'star':
    case 'arc': {
      const r = s.r ?? SHAPE_DEFAULTS.polygonR;
      return { minX: s.x - r, minY: s.y - r, maxX: s.x + r, maxY: s.y + r };
    }
    case 'heart': {
      const sz = s.size ?? SHAPE_DEFAULTS.heartSize;
      return { minX: s.x - sz / 2, minY: s.y - sz / 2, maxX: s.x + sz / 2, maxY: s.y + sz / 2 };
    }
    case 'image': {
      const w = s.w ?? SHAPE_DEFAULTS.imageW;
      const h = s.h ?? SHAPE_DEFAULTS.imageH;
      return { minX: s.x - w / 2, minY: s.y - h / 2, maxX: s.x + w / 2, maxY: s.y + h / 2 };
    }
  }
}

/** 命中测试：点 (px,py) 是否落在图形包围盒内（含一点容差）。 */
export function hitTest(s: Shape, px: number, py: number, pad = 6): boolean {
  const b = getBounds(s);
  return px >= b.minX - pad && px <= b.maxX + pad && py >= b.minY - pad && py <= b.maxY + pad;
}
