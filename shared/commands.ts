import { resolveColor } from './colors';

export type ShapeName =
  | 'circle' | 'rect' | 'line' | 'arrow' | 'triangle' | 'text'
  | 'ellipse' | 'polygon' | 'star' | 'heart' | 'arc';

export type Layout = 'row' | 'col' | 'grid';
export type PositionHint =
  | 'center' | 'top' | 'bottom' | 'left' | 'right'
  | 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
export type Direction = 'up' | 'down' | 'left' | 'right';

export type SelectTarget =
  | { kind: 'last' }
  | { kind: 'all' }
  | { kind: 'byType'; shape: ShapeName }
  | { kind: 'byColor'; color: string }
  | { kind: 'byIndex'; index: number }
  | { kind: 'group'; preset: string };

export interface ShapeProps {
  color?: string;
  fill?: boolean;
  strokeWidth?: number;
  sizeScale?: number;
  text?: string;
  position?: PositionHint;
  sides?: number;
  points?: number;
}

export interface CreateCommand {
  op: 'create';
  shape: ShapeName;
  count?: number;
  layout?: Layout;
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

export interface ComposeCommand {
  op: 'compose';
  preset: string;
  props?: { position?: PositionHint; sizeScale?: number; color?: string };
}

export interface ImagineCommand {
  op: 'imagine';
  prompt: string;
  props?: { position?: PositionHint; sizeScale?: number };
}

export interface UnknownCommand { op: 'unknown'; raw: string; reason?: string }

export type DrawCommand =
  | CreateCommand
  | ComposeCommand
  | ImagineCommand
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
const LAYOUTS: Layout[] = ['row', 'col', 'grid'];
const POSITIONS: PositionHint[] = [
  'center', 'top', 'bottom', 'left', 'right',
  'top-left', 'top-right', 'bottom-left', 'bottom-right',
];
const DIRECTIONS: Direction[] = ['up', 'down', 'left', 'right'];

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

export function isValidCommand(c: unknown): c is DrawCommand {
  if (!c || typeof c !== 'object') return false;
  const op = (c as { op?: unknown }).op;
  switch (op) {
    case 'create':
      return validCreate(c as CreateCommand);
    case 'compose':
      return validCompose(c as ComposeCommand);
    case 'imagine':
      return validImagine(c as ImagineCommand);
    case 'recolor':
      return validTarget((c as RecolorCommand).target) && validColor((c as RecolorCommand).color);
    case 'scale':
      return validTarget((c as ScaleCommand).target) && finiteIn((c as ScaleCommand).factor, 0.05, 10);
    case 'rotate':
      return validTarget((c as RotateCommand).target) && finiteIn((c as RotateCommand).deg, -3600, 3600);
    case 'select':
      return validTarget((c as SelectCommand).target, true);
    case 'move':
      return validMove(c as MoveCommand);
    case 'style':
      return validStyle(c as StyleCommand);
    case 'delete':
      return validTarget((c as DeleteCommand).target);
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

function validCreate(c: CreateCommand): boolean {
  if (!SHAPE_NAMES.includes(c.shape)) return false;
  if (c.count != null && !integerIn(c.count, 1, 50)) return false;
  if (c.layout != null && !LAYOUTS.includes(c.layout)) return false;
  return validProps(c.props);
}

function validCompose(c: ComposeCommand): boolean {
  if (!PRESET_NAMES.includes(c.preset as PresetName)) return false;
  const props = c.props;
  if (props == null) return true;
  if (props.position != null && !POSITIONS.includes(props.position)) return false;
  if (props.sizeScale != null && !finiteIn(props.sizeScale, 0.05, 10)) return false;
  return props.color == null || validColor(props.color);
}

function validImagine(c: ImagineCommand): boolean {
  if (typeof c.prompt !== 'string' || !c.prompt.trim()) return false;
  const props = c.props;
  if (props == null) return true;
  if (props.position != null && !POSITIONS.includes(props.position)) return false;
  return props.sizeScale == null || finiteIn(props.sizeScale, 0.05, 10);
}

function validMove(c: MoveCommand): boolean {
  if (!validTarget(c.target)) return false;
  if (c.direction != null && !DIRECTIONS.includes(c.direction)) return false;
  if (c.distance != null && !finiteIn(c.distance, 1, 5000)) return false;
  if (c.dx != null && !finiteIn(c.dx, -5000, 5000)) return false;
  return c.dy == null || finiteIn(c.dy, -5000, 5000);
}

function validStyle(c: StyleCommand): boolean {
  if (!validTarget(c.target)) return false;
  if (c.fill != null && typeof c.fill !== 'boolean') return false;
  return c.strokeWidth == null || finiteIn(c.strokeWidth, 0.5, 80);
}

function validProps(props: ShapeProps | undefined): boolean {
  if (props == null) return true;
  if (props.color != null && !validColor(props.color)) return false;
  if (props.fill != null && typeof props.fill !== 'boolean') return false;
  if (props.strokeWidth != null && !finiteIn(props.strokeWidth, 0.5, 80)) return false;
  if (props.sizeScale != null && !finiteIn(props.sizeScale, 0.05, 10)) return false;
  if (props.position != null && !POSITIONS.includes(props.position)) return false;
  if (props.sides != null && !integerIn(props.sides, 3, 20)) return false;
  if (props.points != null && !integerIn(props.points, 3, 20)) return false;
  return props.text == null || typeof props.text === 'string';
}

function validTarget(target: SelectTarget | undefined, required = false): boolean {
  if (target == null) return !required;
  if (typeof target !== 'object') return false;
  switch (target.kind) {
    case 'last':
    case 'all':
      return true;
    case 'byType':
      return SHAPE_NAMES.includes(target.shape);
    case 'byColor':
      return validColor(target.color);
    case 'byIndex':
      return integerIn(target.index, 1, 10000);
    case 'group':
      return typeof target.preset === 'string' && target.preset.trim().length > 0;
    default:
      return false;
  }
}

function validColor(color: string | undefined): boolean {
  return typeof color === 'string' && Boolean(resolveColor(color));
}

function finiteIn(n: number | undefined, min: number, max: number): boolean {
  return typeof n === 'number' && Number.isFinite(n) && n >= min && n <= max;
}

function integerIn(n: number | undefined, min: number, max: number): boolean {
  return typeof n === 'number' && Number.isInteger(n) && n >= min && n <= max;
}
