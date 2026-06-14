// CommandExecutor —— 把结构化 DrawCommand 应用到 CanvasEngine。
// 负责：目标指代解析、count/layout 批量排布、相对尺寸/方位换算，
// 并为每条命令生成中文反馈文案（供日志与 TTS 播报）。

import { resolveColor } from '@shared/colors';
import {
  PRESET_LABEL,
  SHAPE_LABEL,
  type BackgroundCommand,
  type ComposeCommand,
  type CreateCommand,
  type Direction,
  type DrawCommand,
  type PositionHint,
  type SelectTarget,
  type SwitchPageCommand,
} from '@shared/commands';
import { CanvasEngine } from '../engine/CanvasEngine';
import { nextGroupId, SHAPE_DEFAULTS, type Shape, type ShapeType } from '../engine/shapes';
import { PRESETS } from './presets';
import { autoPlace, positionToXY } from './placement';

export interface ExecOutcome {
  ok: boolean;
  /** 面向用户的中文反馈（成功描述或失败原因）。 */
  message: string;
  command: DrawCommand;
}

const DEFAULT_MOVE = 60;

const POSITION_LABEL: Record<PositionHint, string> = {
  center: '中间',
  top: '上方',
  bottom: '下方',
  left: '左侧',
  right: '右侧',
  'top-left': '左上角',
  'top-right': '右上角',
  'bottom-left': '左下角',
  'bottom-right': '右下角',
};

export class CommandExecutor {
  constructor(private engine: CanvasEngine) {}

  executeAll(cmds: DrawCommand[]): ExecOutcome[] {
    if (cmds.length <= 1) return cmds.map((c) => this.execute(c));
    const before = this.engine.getState();
    const outcomes: ExecOutcome[] = [];
    for (let i = 0; i < cmds.length; i++) {
      const outcome = this.execute(cmds[i]);
      if (!outcome.ok) {
        this.engine.replaceState(before);
        outcomes.push({ ...outcome, message: `第 ${i + 1} 步失败：${outcome.message}` });
        return outcomes;
      }
      outcomes.push(outcome);
    }
    return outcomes;
  }

  execute(cmd: DrawCommand): ExecOutcome {
    switch (cmd.op) {
      case 'create':
        return this.create(cmd);
      case 'compose':
        return this.compose(cmd);
      case 'imagine':
        // AI 文生图为异步流程，由 useDrawController 处理；执行器不直接落地。
        return { ok: false, message: '图片生成由控制器处理', command: cmd };
      case 'select':
        return this.select(cmd.target);
      case 'move':
        return this.move(cmd);
      case 'scale':
        return this.scale(cmd.factor, cmd.target);
      case 'rotate':
        return this.rotate(cmd.deg, cmd.target);
      case 'recolor':
        return this.recolor(cmd.color, cmd.target);
      case 'style':
        return this.style(cmd);
      case 'delete':
        return this.remove(cmd.target);
      case 'undo':
        return { ok: this.engine.undo(), message: '已撤销', command: cmd };
      case 'redo':
        return { ok: this.engine.redo(), message: '已重做', command: cmd };
      case 'clear':
        this.engine.clear();
        return { ok: true, message: '已清空画布', command: cmd };
      case 'background':
        return this.setBackground(cmd);
      case 'newPage':
        this.engine.newPage();
        return { ok: true, message: `已新建画布（第 ${this.engine.getState().pageCount} 张），原画布已保留`, command: cmd };
      case 'switchPage':
        return this.switchPage(cmd);
      case 'export':
        return this.exportPng(cmd);
      case 'unknown':
        return { ok: false, message: '没太听清，可以换种说法再说一次，比如「画一个红色的圆」', command: cmd };
    }
  }

  // —— 创建 ——
  private create(cmd: CreateCommand): ExecOutcome {
    const count = Math.max(1, Math.min(cmd.count ?? 1, 20));
    const props = cmd.props ?? {};
    const color = resolveColor(props.color);
    const scale = props.sizeScale ?? 1;
    const center = this.resolveCenter(props.position, count === 1);
    const positions = this.layoutPositions(count, cmd.layout ?? 'row', center);

    const specs = positions.map((pos) => ({
      type: cmd.shape as ShapeType,
      props: this.sizedProps(cmd.shape as ShapeType, scale, {
        ...pos,
        ...(color ? { color } : {}),
        ...(props.fill != null ? { fill: props.fill } : {}),
        ...(props.strokeWidth != null ? { strokeWidth: props.strokeWidth } : {}),
        ...(props.text != null ? { text: props.text } : {}),
        ...(props.sides != null ? { sides: props.sides } : {}),
        ...(props.points != null ? { points: props.points } : {}),
      }, props.direction),
    }));

    this.engine.addMany(specs);
    const colorLabel = props.color && color ? describeColor(props.color) : '';
    const sizeLabel = scale > 1.1 ? '大' : scale < 0.9 ? '小' : '';
    const label = SHAPE_LABEL[cmd.shape];
    const countLabel = count > 1 ? `${count}个` : '一个';
    const layoutLabel = count > 1 ? this.layoutLabel(cmd.layout ?? 'row') : '';
    return {
      ok: true,
      message: `已画${countLabel}${sizeLabel}${colorLabel}${label}${layoutLabel}`,
      command: cmd,
    };
  }

  // —— 导出 PNG（真正触发浏览器下载）——
  private exportPng(cmd: DrawCommand): ExecOutcome {
    if (!this.engine.getState().shapes.length) {
      return { ok: false, message: '画布是空的，没有可保存的内容', command: cmd };
    }
    const url = this.engine.toDataURL();
    if (typeof document !== 'undefined') {
      const a = document.createElement('a');
      a.href = url;
      a.download = `sonicraft-${Date.now()}.png`;
      document.body.appendChild(a);
      a.click();
      a.remove();
    }
    return { ok: true, message: '已保存为图片', command: cmd };
  }

  // —— 组合/语义绘图 ——
  private compose(cmd: ComposeCommand): ExecOutcome {
    const fn = PRESETS[cmd.preset];
    if (!fn) {
      return {
        ok: false,
        message: `暂时不会画「${cmd.preset}」，可以说画圆、笑脸、房子、太阳、树、花`,
        command: cmd,
      };
    }
    const props = cmd.props ?? {};
    const { x, y } = this.resolveCenter(props.position, true);
    const color = resolveColor(props.color) ?? '';
    // 同组图元共享 groupId + groupKind，使其可作为整体重选与变换（绕组中心缩放不散开）。
    const groupId = nextGroupId();
    const specs = fn(x, y, props.sizeScale ?? 1, color).map((spec) => ({
      type: spec.type,
      props: { ...spec.props, groupId, groupKind: cmd.preset },
    }));
    this.engine.addMany(specs);
    return { ok: true, message: `已画一个${PRESET_LABEL[cmd.preset] ?? cmd.preset}`, command: cmd };
  }

  /** 按相对缩放系数算出该形状的实际尺寸属性。direction 仅用于线/箭头朝向。 */
  private sizedProps(type: ShapeType, scale: number, extra: Partial<Shape>, direction?: Direction): Partial<Shape> {
    const p: Partial<Shape> = { ...extra };
    switch (type) {
      case 'circle':
        p.r = SHAPE_DEFAULTS.circleR * scale;
        break;
      case 'rect':
        p.w = SHAPE_DEFAULTS.rectW * scale;
        p.h = SHAPE_DEFAULTS.rectH * scale;
        break;
      case 'triangle':
        p.size = SHAPE_DEFAULTS.triangleSize * scale;
        break;
      case 'text':
        p.fontSize = SHAPE_DEFAULTS.fontSize * scale;
        break;
      case 'line':
      case 'arrow':
        if (p.x != null && p.y != null) {
          const len = SHAPE_DEFAULTS.lineLen * scale;
          // 默认水平向右；direction 指定时按朝向放置终点。
          const dir = direction ?? 'right';
          if (dir === 'left') { p.x2 = p.x - len; p.y2 = p.y; }
          else if (dir === 'up') { p.x2 = p.x; p.y2 = p.y - len; }
          else if (dir === 'down') { p.x2 = p.x; p.y2 = p.y + len; }
          else { p.x2 = p.x + len; p.y2 = p.y; }
        }
        break;
      case 'ellipse':
        p.w = SHAPE_DEFAULTS.ellipseW * scale;
        p.h = SHAPE_DEFAULTS.ellipseH * scale;
        break;
      case 'polygon':
        p.r = SHAPE_DEFAULTS.polygonR * scale;
        break;
      case 'star':
        p.r = SHAPE_DEFAULTS.starR * scale;
        break;
      case 'heart':
        p.size = SHAPE_DEFAULTS.heartSize * scale;
        break;
      case 'arc':
        p.r = SHAPE_DEFAULTS.arcR * scale;
        p.a0 = 0;
        p.a1 = 180;
        break;
    }
    return p;
  }

  /** 解析落点：给了方位用方位；否则单个图形走防重叠自动选点，多个走画布中心。 */
  private resolveCenter(pos: PositionHint | undefined, single: boolean): { x: number; y: number } {
    const W = this.engine.width;
    const H = this.engine.height;
    if (pos) return positionToXY(pos, W, H);
    if (single) return autoPlace(this.engine.getState().shapes, W, H);
    return positionToXY(undefined, W, H);
  }

  /** 计算 count 个图形的中心坐标，支持 row/col/grid（围绕给定 center 排布）。 */
  private layoutPositions(count: number, layout: 'row' | 'col' | 'grid', center: { x: number; y: number }) {
    const W = this.engine.width;
    const H = this.engine.height;
    if (count === 1) return [center];

    const gap = Math.min(180, (W * 0.8) / count);
    const out: Array<{ x: number; y: number }> = [];
    if (layout === 'row') {
      const start = center.x - (gap * (count - 1)) / 2;
      for (let i = 0; i < count; i++) out.push({ x: start + i * gap, y: center.y });
    } else if (layout === 'col') {
      const vgap = Math.min(140, (H * 0.8) / count);
      const start = center.y - (vgap * (count - 1)) / 2;
      for (let i = 0; i < count; i++) out.push({ x: center.x, y: start + i * vgap });
    } else {
      const cols = Math.ceil(Math.sqrt(count));
      const vgap = Math.min(140, gap);
      const startX = center.x - (gap * (cols - 1)) / 2;
      for (let i = 0; i < count; i++) {
        const r = Math.floor(i / cols);
        const c = i % cols;
        out.push({ x: startX + c * gap, y: center.y + (r - (Math.ceil(count / cols) - 1) / 2) * vgap });
      }
    }
    return out;
  }

  private layoutLabel(layout: 'row' | 'col' | 'grid'): string {
    return layout === 'row' ? '排成一行' : layout === 'col' ? '排成一列' : '排成网格';
  }

  // —— 选区 / 指代解析 ——
  private resolveTarget(target?: SelectTarget): string[] {
    const { shapes, selectedIds } = this.engine.getState();
    // 默认作用于当前选区；扩展到完整组，使“房子”整体被命中。
    if (!target) return this.engine.expandGroups(selectedIds);
    switch (target.kind) {
      case 'last':
        // “最后一个”指最近创建：若它属于某组，则整组（删一座房子而非只删一块）。
        return this.engine.expandGroups(this.engine.lastShapeId());
      case 'all':
        return shapes.map((s) => s.id);
      case 'byType':
        return shapes.filter((s) => s.type === target.shape).map((s) => s.id);
      case 'byColor': {
        const c = resolveColor(target.color);
        return shapes.filter((s) => s.color === c).map((s) => s.id);
      }
      case 'byIndex': {
        const s = shapes[target.index - 1];
        return s ? this.engine.expandGroups([s.id]) : [];
      }
      case 'group':
        // 按组合预设名整体选中（如所有“房子”的全部部件）。
        return shapes.filter((s) => s.groupKind === target.preset).map((s) => s.id);
    }
  }

  private select(target: SelectTarget): ExecOutcome {
    const ids = this.resolveTarget(target);
    this.engine.select(ids);
    return { ok: ids.length > 0, message: ids.length ? `已选中 ${ids.length} 个图形` : '没有匹配的图形', command: { op: 'select', target } };
  }

  private move(cmd: DrawCommand & { op: 'move' }): ExecOutcome {
    const ids = this.resolveTarget(cmd.target);
    if (!ids.length) return { ok: false, message: '请先选择要移动的图形', command: cmd };
    let dx = cmd.dx ?? 0;
    let dy = cmd.dy ?? 0;
    if (cmd.position) {
      // 绝对定位：把目标整体中心搬到画布该方位处。
      const center = this.engine.idsCenter(ids);
      const dest = positionToXY(cmd.position, this.engine.width, this.engine.height);
      dx = dest.x - center.x;
      dy = dest.y - center.y;
    } else if (cmd.direction) {
      const d = cmd.distance ?? DEFAULT_MOVE;
      if (cmd.direction === 'left') dx = -d;
      if (cmd.direction === 'right') dx = d;
      if (cmd.direction === 'up') dy = -d;
      if (cmd.direction === 'down') dy = d;
    }
    this.engine.move(dx, dy, ids);
    const where = cmd.position ? `到${POSITION_LABEL[cmd.position]}` : '';
    return { ok: true, message: `已移动${where}`, command: cmd };
  }

  // —— 画布背景 ——
  private setBackground(cmd: BackgroundCommand): ExecOutcome {
    if (cmd.mode === 'clear') {
      this.engine.clearBackground();
      return { ok: true, message: '已恢复空白背景', command: cmd };
    }
    if (cmd.mode === 'color') {
      const hex = resolveColor(cmd.color);
      if (!hex) return { ok: false, message: `不认识的颜色：${cmd.color ?? ''}`, command: cmd };
      this.engine.setBackgroundColor(hex);
      return { ok: true, message: `已将背景改成${describeColor(cmd.color ?? '')}`, command: cmd };
    }
    // image 模式为异步文生图，由控制器处理（同 imagine）。
    return { ok: false, message: '背景图片由控制器处理', command: cmd };
  }

  // —— 切换画布 ——
  private switchPage(cmd: SwitchPageCommand): ExecOutcome {
    const { pageCount, pageIndex } = this.engine.getState();
    const target = cmd.index != null ? cmd.index - 1 : pageIndex + (cmd.delta ?? 0);
    if (target < 0 || target >= pageCount) {
      return { ok: false, message: `没有第 ${target + 1} 张画布（共 ${pageCount} 张）`, command: cmd };
    }
    this.engine.switchPage(target);
    return { ok: true, message: `已切换到画布 ${target + 1}/${pageCount}`, command: cmd };
  }

  private scale(factor: number, target?: SelectTarget): ExecOutcome {
    const ids = this.resolveTarget(target);
    if (!ids.length) return { ok: false, message: '请先选择要缩放的图形', command: { op: 'scale', factor, target } };
    this.engine.scale(factor, ids);
    return { ok: true, message: factor >= 1 ? '已放大' : '已缩小', command: { op: 'scale', factor, target } };
  }

  private rotate(deg: number, target?: SelectTarget): ExecOutcome {
    const ids = this.resolveTarget(target);
    if (!ids.length) return { ok: false, message: '请先选择要旋转的图形', command: { op: 'rotate', deg, target } };
    this.engine.rotate(deg, ids);
    return { ok: true, message: `已旋转 ${deg} 度`, command: { op: 'rotate', deg, target } };
  }

  private recolor(color: string, target?: SelectTarget): ExecOutcome {
    const resolved = resolveColor(color);
    const ids = this.resolveTarget(target);
    if (!resolved) return { ok: false, message: `不认识的颜色：${color}`, command: { op: 'recolor', color, target } };
    if (!ids.length) return { ok: false, message: '请先选择要改色的图形', command: { op: 'recolor', color, target } };
    this.engine.recolor(resolved, ids);
    return { ok: true, message: `已改成${describeColor(color)}`, command: { op: 'recolor', color, target } };
  }

  private style(cmd: DrawCommand & { op: 'style' }): ExecOutcome {
    const ids = this.resolveTarget(cmd.target);
    if (!ids.length) return { ok: false, message: '还没有选中图形，先说「选中最后一个」或某个图形', command: cmd };
    const patch: Partial<Shape> = {};
    if (cmd.fill != null) patch.fill = cmd.fill;
    if (cmd.strokeWidth != null) patch.strokeWidth = cmd.strokeWidth;
    this.engine.update(patch, ids);
    const parts: string[] = [];
    if (cmd.fill != null) parts.push(cmd.fill ? '改为实心' : '改为空心');
    if (cmd.strokeWidth != null) parts.push(cmd.strokeWidth >= 6 ? '描边加粗' : '描边变细');
    return { ok: true, message: `已${parts.join('、') || '调整样式'}`, command: cmd };
  }

  private remove(target?: SelectTarget): ExecOutcome {
    const ids = this.resolveTarget(target);
    if (!ids.length) return { ok: false, message: '没有可删除的图形', command: { op: 'delete', target } };
    this.engine.remove(ids);
    return { ok: true, message: `已删除 ${ids.length} 个图形`, command: { op: 'delete', target } };
  }
}

/** 颜色原词去掉“色”字用于口语反馈（“红色”→“红色”，“蓝”→“蓝色”）。 */
function describeColor(raw: string): string {
  const t = raw.trim();
  if (/[一-龥]/.test(t)) return t.endsWith('色') ? t : `${t}色`;
  return t;
}
