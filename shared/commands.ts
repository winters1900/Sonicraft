// DrawCommand DSL —— 自然语言指令解析后的结构化中间表示。
// 规则解析器(本地)与 LLM 解析器(后端)都产出 DrawCommand[]，由 CommandExecutor 统一执行。
// 一句话可拆解为多条命令，这是“复杂指令拆解”的载体。

export type ShapeName =
  | 'circle' | 'rect' | 'line' | 'arrow' | 'triangle' | 'text'
  | 'ellipse' | 'polygon' | 'star' | 'heart' | 'arc';

export type Layout = 'row' | 'col' | 'grid';

/** 画面方位提示，执行器按画布尺寸换算为坐标。 */
export type PositionHint =
  | 'center' | 'top' | 'bottom' | 'left' | 'right'
  | 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';

export type Direction = 'up' | 'down' | 'left' | 'right';

/** 选择/指代目标。省略时执行器默认作用于当前选中集合。 */
export type SelectTarget =
  | { kind: 'last' }
  | { kind: 'all' }
  | { kind: 'byType'; shape: ShapeName }
  | { kind: 'byColor'; color: string }
  | { kind: 'byIndex'; index: number } // 1-based，从最早创建算起
  | { kind: 'group'; preset: string }; // 按组合预设名整体选中（“选中房子”）

export interface ShapeProps {
  color?: string;
  fill?: boolean;
  strokeWidth?: number;
  /** 相对默认尺寸的缩放系数（“大一点”=1.3，“小”=0.6）。 */
  sizeScale?: number;
  /** text 图形的文字内容。 */
  text?: string;
  position?: PositionHint;
  /** polygon 的边数（五边形=5，六边形=6…）。 */
  sides?: number;
  /** star 的角数（五角星=5）。 */
  points?: number;
}

export interface CreateCommand {
  op: 'create';
  shape: ShapeName;
  count?: number; // 默认 1
  layout?: Layout; // count>1 时的排布方式，默认 row
  props?: ShapeProps;
}

export interface SelectCommand { op: 'select'; target: SelectTarget }
export interface MoveCommand { op: 'move'; target?: SelectTarget; direction?: Direction; distance?: number; dx?: number; dy?: number }
export interface ScaleCommand { op: 'scale'; target?: SelectTarget; factor: number }
export interface RotateCommand { op: 'rotate'; target?: SelectTarget; deg: number }
export interface RecolorCommand { op: 'recolor'; target?: SelectTarget; color: string }
export interface StyleCommand { op: 'style'; target?: SelectTarget; fill?: boolean; strokeWidth?: number }
export interface DeleteCommand { op: 'delete'; target?: SelectTarget }
export interface UndoCommand { op: 'undo' }
export interface RedoCommand { op: 'redo' }
export interface ClearCommand { op: 'clear' }
export interface ExportCommand { op: 'export' }
/** 组合/语义绘图：一个预设名展开为多个图元（笑脸/房子/太阳…），是“复杂指令拆解”的载体。 */
export interface ComposeCommand {
  op: 'compose';
  preset: string;
  props?: { position?: PositionHint; sizeScale?: number; color?: string };
}
/** 无法解析时的兜底，携带原文以便语音追问。 */
export interface UnknownCommand { op: 'unknown'; raw: string; reason?: string }

export type DrawCommand =
  | CreateCommand
  | ComposeCommand
  | SelectCommand
  | MoveCommand
  | ScaleCommand
  | RotateCommand
  | RecolorCommand
  | StyleCommand
  | DeleteCommand
  | UndoCommand
  | RedoCommand
  | ClearCommand
  | ExportCommand
  | UnknownCommand;

export const SHAPE_NAMES: ShapeName[] = [
  'circle', 'rect', 'line', 'arrow', 'triangle', 'text',
  'ellipse', 'polygon', 'star', 'heart', 'arc',
];

/** 形状的中文显示名，用于语音/文字反馈。 */
export const SHAPE_LABEL: Record<ShapeName, string> = {
  circle: '圆形',
  rect: '矩形',
  line: '线条',
  arrow: '箭头',
  triangle: '三角形',
  text: '文字',
  ellipse: '椭圆',
  polygon: '多边形',
  star: '星形',
  heart: '心形',
  arc: '弧形',
};

/** 组合预设名清单与中文显示名。 */
export const PRESET_NAMES = ['face', 'house', 'sun', 'tree', 'flower', 'snowman', 'cat'] as const;
export type PresetName = (typeof PRESET_NAMES)[number];
export const PRESET_LABEL: Record<string, string> = {
  face: '笑脸',
  house: '房子',
  sun: '太阳',
  tree: '树',
  flower: '花朵',
  snowman: '雪人',
  cat: '小猫',
};

/** 轻量结构校验：过滤掉缺关键字段的非法命令，保证执行器输入可靠。 */
export function isValidCommand(c: unknown): c is DrawCommand {
  if (!c || typeof c !== 'object') return false;
  const op = (c as { op?: unknown }).op;
  switch (op) {
    case 'create':
      return SHAPE_NAMES.includes((c as CreateCommand).shape);
    case 'compose':
      return PRESET_NAMES.includes((c as ComposeCommand).preset as PresetName);
    case 'recolor':
      return typeof (c as RecolorCommand).color === 'string';
    case 'scale':
      return typeof (c as ScaleCommand).factor === 'number';
    case 'rotate':
      return typeof (c as RotateCommand).deg === 'number';
    case 'select':
      return typeof (c as SelectCommand).target === 'object';
    case 'move':
    case 'style':
    case 'delete':
    case 'undo':
    case 'redo':
    case 'clear':
    case 'export':
    case 'unknown':
      return true;
    default:
      return false;
  }
}
