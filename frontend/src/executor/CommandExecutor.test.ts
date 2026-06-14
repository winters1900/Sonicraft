import { beforeEach, describe, expect, it } from 'vitest';
import { CanvasEngine } from '../engine/CanvasEngine';
import { __resetIdSeq, getBounds, type Shape, type ShapeType } from '../engine/shapes';
import { CommandExecutor } from './CommandExecutor';
import { isValidCommand, type DrawCommand } from '@shared/commands';

// Node 环境无 DOM，这里用 Proxy 伪造一个 2D 上下文（所有方法均为 no-op），
// 让引擎可在测试中实例化而无需真实 canvas。
function makeEngine(w = 960, h = 600) {
  const ctx = new Proxy({}, { get: () => () => {} }) as unknown as CanvasRenderingContext2D;
  const canvas = {
    width: w,
    height: h,
    getContext: () => ctx,
    toDataURL: () => 'data:image/png;base64,xxx',
  } as unknown as HTMLCanvasElement;
  return new CanvasEngine(canvas);
}

function setup() {
  const engine = makeEngine();
  const exec = new CommandExecutor(engine);
  return { engine, exec };
}

beforeEach(() => __resetIdSeq());

describe('create', () => {
  it('画一个红色圆形：补全默认尺寸并解析颜色', () => {
    const { engine, exec } = setup();
    const r = exec.execute({ op: 'create', shape: 'circle', props: { color: '红色' } });
    const { shapes } = engine.getState();
    expect(shapes).toHaveLength(1);
    expect(shapes[0].type).toBe('circle');
    expect(shapes[0].color).toBe('#e23b3b');
    expect(shapes[0].r).toBeGreaterThan(0);
    expect(r.message).toContain('圆形');
  });

  it('画三个圆排成一行：数量与横向排布', () => {
    const { engine, exec } = setup();
    exec.execute({ op: 'create', shape: 'circle', count: 3, layout: 'row' });
    const { shapes } = engine.getState();
    expect(shapes).toHaveLength(3);
    const ys = new Set(shapes.map((s) => Math.round(s.y)));
    expect(ys.size).toBe(1); // 同一行 y 相同
    const xs = shapes.map((s) => s.x);
    expect(xs[0]).toBeLessThan(xs[1]);
    expect(xs[1]).toBeLessThan(xs[2]);
  });

  it('sizeScale 放大默认尺寸', () => {
    const { engine, exec } = setup();
    exec.execute({ op: 'create', shape: 'circle' });
    const base = engine.getState().shapes[0].r!;
    engine.clear();
    exec.execute({ op: 'create', shape: 'circle', props: { sizeScale: 2 } });
    expect(engine.getState().shapes[0].r!).toBeCloseTo(base * 2);
  });

  it('批量创建是单一可撤销单元', () => {
    const { engine, exec } = setup();
    exec.execute({ op: 'create', shape: 'rect', count: 4 });
    expect(engine.getState().shapes).toHaveLength(4);
    engine.undo();
    expect(engine.getState().shapes).toHaveLength(0);
  });
});

describe('新增形状 create', () => {
  it('star 设置 points，polygon 设置 sides', () => {
    const { engine, exec } = setup();
    exec.execute({ op: 'create', shape: 'star', props: { points: 6 } });
    exec.execute({ op: 'create', shape: 'polygon', props: { sides: 8 } });
    const [star, poly] = engine.getState().shapes;
    expect(star.type).toBe('star');
    expect(star.points).toBe(6);
    expect(star.r).toBeGreaterThan(0);
    expect(poly.sides).toBe(8);
  });

  it('ellipse 有 w/h，heart 有 size，arc 有 r 与角度', () => {
    const { engine, exec } = setup();
    exec.execute({ op: 'create', shape: 'ellipse' });
    exec.execute({ op: 'create', shape: 'heart' });
    exec.execute({ op: 'create', shape: 'arc' });
    const [el, ht, ar] = engine.getState().shapes;
    expect(el.w).toBeGreaterThan(0);
    expect(el.h).toBeGreaterThan(0);
    expect(ht.size).toBeGreaterThan(0);
    expect(ar.r).toBeGreaterThan(0);
    expect(ar.a1).toBe(180);
  });
});

describe('compose 组合绘图', () => {
  it('笑脸展开为多个图元，且为单一可撤销单元', () => {
    const { engine, exec } = setup();
    const r = exec.execute({ op: 'compose', preset: 'face' });
    expect(r.ok).toBe(true);
    expect(r.message).toContain('笑脸');
    expect(engine.getState().shapes.length).toBeGreaterThanOrEqual(4);
    engine.undo();
    expect(engine.getState().shapes).toHaveLength(0);
  });

  it('未知预设返回失败、不落地图形', () => {
    const { engine, exec } = setup();
    const r = exec.execute({ op: 'compose', preset: 'dragon' } as DrawCommand);
    expect(r.ok).toBe(false);
    expect(engine.getState().shapes).toHaveLength(0);
  });

  it('compose 尊重方位（右上角偏移到右上区域）', () => {
    const { engine, exec } = setup();
    exec.execute({ op: 'compose', preset: 'sun', props: { position: 'top-right' } });
    const xs = engine.getState().shapes.map((s) => s.x);
    const ys = engine.getState().shapes.map((s) => s.y);
    expect(Math.max(...xs)).toBeGreaterThan(960 / 2);
    expect(Math.min(...ys)).toBeLessThan(600 / 2);
  });
});

describe('compose 分组（v2）', () => {
  it('同组图元共享 groupId 与 groupKind', () => {
    const { engine, exec } = setup();
    exec.execute({ op: 'compose', preset: 'house' });
    const shapes = engine.getState().shapes;
    const gids = new Set(shapes.map((s) => s.groupId));
    expect(gids.size).toBe(1);
    expect([...gids][0]).toBeTruthy();
    expect(shapes.every((s) => s.groupKind === 'house')).toBe(true);
  });

  it('按预设名整体选中（选中房子）', () => {
    const { engine, exec } = setup();
    exec.execute({ op: 'compose', preset: 'house' });
    const houseCount = engine.getState().shapes.length;
    exec.execute({ op: 'create', shape: 'circle' }); // 干扰项
    exec.execute({ op: 'select', target: { kind: 'group', preset: 'house' } });
    expect(engine.getState().selectedIds).toHaveLength(houseCount);
  });

  it('“最后一个”删除会删掉整组（不残留半座房子）', () => {
    const { engine, exec } = setup();
    exec.execute({ op: 'create', shape: 'circle' });
    exec.execute({ op: 'compose', preset: 'face' });
    exec.execute({ op: 'delete', target: { kind: 'last' } });
    const shapes = engine.getState().shapes;
    expect(shapes).toHaveLength(1);
    expect(shapes[0].type).toBe('circle');
  });

  it('整组缩放绕组中心：相对排布保持、整体中心不漂移', () => {
    const { engine, exec } = setup();
    exec.execute({ op: 'compose', preset: 'face' }); // 整组选中
    const before = engine.getState().shapes.map((s) => ({ x: s.x, y: s.y }));
    const cx0 = before.reduce((a, p) => a + p.x, 0) / before.length;
    exec.execute({ op: 'scale', factor: 2 }); // 作用于当前选区=整组
    const after = engine.getState().shapes.map((s) => ({ x: s.x, y: s.y }));
    const cx1 = after.reduce((a, p) => a + p.x, 0) / after.length;
    expect(cx1).toBeCloseTo(cx0, 0); // 锚点均值近似不漂移（绕中心缩放）
    // 任意两部件间距随缩放放大（不再原地各自缩放）
    const d0 = Math.hypot(before[1].x - before[2].x, before[1].y - before[2].y);
    const d1 = Math.hypot(after[1].x - after[2].x, after[1].y - after[2].y);
    expect(d1).toBeCloseTo(d0 * 2, 0);
  });
});

describe('指代与变换', () => {
  it('byType 选中所有圆', () => {
    const { engine, exec } = setup();
    exec.execute({ op: 'create', shape: 'circle' });
    exec.execute({ op: 'create', shape: 'rect' });
    exec.execute({ op: 'create', shape: 'circle' });
    const r = exec.execute({ op: 'select', target: { kind: 'byType', shape: 'circle' } });
    expect(r.ok).toBe(true);
    expect(engine.getState().selectedIds).toHaveLength(2);
  });

  it('recolor 作用于当前选中', () => {
    const { engine, exec } = setup();
    exec.execute({ op: 'create', shape: 'rect' }); // 新建即选中
    exec.execute({ op: 'recolor', color: '蓝色' });
    expect(engine.getState().shapes[0].color).toBe('#2f7be2');
  });

  it('byIndex 选中第 2 个（1-based）', () => {
    const { engine, exec } = setup();
    exec.execute({ op: 'create', shape: 'circle' });
    exec.execute({ op: 'create', shape: 'rect' });
    exec.execute({ op: 'select', target: { kind: 'byIndex', index: 2 } });
    const sel = engine.getState().selectedIds;
    expect(sel).toHaveLength(1);
    const target = engine.getState().shapes.find((s) => s.id === sel[0]);
    expect(target?.type).toBe('rect');
  });

  it('删除最后一个', () => {
    const { engine, exec } = setup();
    exec.execute({ op: 'create', shape: 'circle' });
    exec.execute({ op: 'create', shape: 'rect' });
    exec.execute({ op: 'delete', target: { kind: 'last' } });
    const { shapes } = engine.getState();
    expect(shapes).toHaveLength(1);
    expect(shapes[0].type).toBe('circle');
  });

  it('move 方向+距离', () => {
    const { engine, exec } = setup();
    exec.execute({ op: 'create', shape: 'circle' });
    const x0 = engine.getState().shapes[0].x;
    exec.execute({ op: 'move', direction: 'right', distance: 100 });
    expect(engine.getState().shapes[0].x).toBeCloseTo(x0 + 100);
  });
});

describe('全局命令与容错', () => {
  it('undo/redo 往返', () => {
    const { engine, exec } = setup();
    exec.execute({ op: 'create', shape: 'circle' });
    exec.execute({ op: 'undo' });
    expect(engine.getState().shapes).toHaveLength(0);
    exec.execute({ op: 'redo' });
    expect(engine.getState().shapes).toHaveLength(1);
  });

  it('clear 清空', () => {
    const { engine, exec } = setup();
    exec.execute({ op: 'create', shape: 'circle', count: 3 });
    exec.execute({ op: 'clear' });
    expect(engine.getState().shapes).toHaveLength(0);
  });

  it('export：空画布失败，有内容成功（node 环境无 document 不触发下载）', () => {
    const { engine, exec } = setup();
    expect(exec.execute({ op: 'export' }).ok).toBe(false);
    exec.execute({ op: 'create', shape: 'circle' });
    const r = exec.execute({ op: 'export' });
    expect(r.ok).toBe(true);
    expect(r.message).toContain('图片');
    expect(engine.getState().shapes).toHaveLength(1); // 导出不改动画布
  });

  it('unknown 返回失败但不抛错', () => {
    const { exec } = setup();
    const r = exec.execute({ op: 'unknown', raw: '随便说点啥' } as DrawCommand);
    expect(r.ok).toBe(false);
    expect(r.message).toContain('再说一次'); // 友好的语音追问，而非回读原话
  });

  it('未识别颜色返回失败', () => {
    const { exec } = setup();
    exec.execute({ op: 'create', shape: 'circle' });
    const r = exec.execute({ op: 'recolor', color: '马卡龙紫罗兰' });
    expect(r.ok).toBe(false);
  });
});

describe('isValidCommand 校验', () => {
  it('接受新增形状与合法 compose', () => {
    expect(isValidCommand({ op: 'create', shape: 'star' })).toBe(true);
    expect(isValidCommand({ op: 'create', shape: 'heart' })).toBe(true);
    expect(isValidCommand({ op: 'compose', preset: 'face' })).toBe(true);
  });
  it('拒绝未知预设与未知形状', () => {
    expect(isValidCommand({ op: 'compose', preset: 'dragon' })).toBe(false);
    expect(isValidCommand({ op: 'create', shape: 'blob' })).toBe(false);
  });
});

describe('getBounds 覆盖新形状（守住 undefined 崩溃）', () => {
  const types: ShapeType[] = ['ellipse', 'polygon', 'star', 'heart', 'arc'];
  it('每种新形状都返回有限包围盒', () => {
    for (const type of types) {
      const s = { id: 'x', type, x: 100, y: 100, color: '#000', fill: false, strokeWidth: 2, rotation: 0 } as Shape;
      const b = getBounds(s);
      expect(Number.isFinite(b.minX)).toBe(true);
      expect(Number.isFinite(b.maxX)).toBe(true);
      expect(b.maxX).toBeGreaterThan(b.minX);
      expect(b.maxY).toBeGreaterThan(b.minY);
    }
  });
});
