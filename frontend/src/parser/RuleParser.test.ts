import { describe, expect, it } from 'vitest';
import { parseWithRules } from './RuleParser';
import { resolveColor } from '@shared/colors';
import type { CreateCommand } from '@shared/commands';

function first(text: string) {
  return parseWithRules(text).commands[0];
}

describe('AI 文生图路由', () => {
  it('画一只熊猫 → imagine（不再误判为猫）', () => {
    const c = first('画一只熊猫') as { op: string; prompt: string };
    expect(c.op).toBe('imagine');
    expect(c.prompt).toContain('熊猫');
  });

  it('画一个芒果 → imagine（未知物体走文生图）', () => {
    const c = first('画一个芒果') as { op: string; prompt: string };
    expect(c.op).toBe('imagine');
    expect(c.prompt).toBe('芒果');
  });

  it('在右上角画一只老虎 → imagine 且带方位', () => {
    const c = first('在右上角画一只老虎') as { op: string; prompt: string; props?: { position?: string } };
    expect(c.op).toBe('imagine');
    expect(c.prompt).toContain('老虎');
    expect(c.props?.position).toBe('top-right');
  });

  it('画一只猫 仍走预设 compose（augment 不抢几何）', () => {
    const c = first('画一只猫') as { op: string; preset?: string };
    expect(c.op).toBe('compose');
    expect(c.preset).toBe('cat');
  });

  it('画一个圆 仍走几何 create（不被文生图截胡）', () => {
    expect(first('画一个圆').op).toBe('create');
  });
});

describe('创建类指令', () => {
  it('画一个红色的圆', () => {
    const c = first('画一个红色的圆') as CreateCommand;
    expect(c.op).toBe('create');
    expect(c.shape).toBe('circle');
    expect(resolveColor(c.props?.color)).toBe('#e23b3b');
  });

  it('画三个蓝色的圆排成一行', () => {
    const c = first('画三个蓝色的圆排成一行') as CreateCommand;
    expect(c.shape).toBe('circle');
    expect(c.count).toBe(3);
    expect(c.layout).toBe('row');
    expect(resolveColor(c.props?.color)).toBe('#2f7be2');
  });

  it('在左上角画个大三角形', () => {
    const c = first('在左上角画个大三角形') as CreateCommand;
    expect(c.shape).toBe('triangle');
    expect(c.props?.position).toBe('top-left');
    expect(c.props?.sizeScale).toBeGreaterThan(1);
  });

  it('写你好', () => {
    const c = first('写你好') as CreateCommand;
    expect(c.shape).toBe('text');
    expect(c.props?.text).toBe('你好');
  });

  it('实心的红色正方形', () => {
    const c = first('画一个实心的红色正方形') as CreateCommand;
    expect(c.shape).toBe('rect');
    expect(c.props?.fill).toBe(true);
  });
});

describe('新增形状', () => {
  it('画一个五角星 → star，points=5', () => {
    const c = first('画一个五角星') as CreateCommand;
    expect(c.op).toBe('create');
    expect(c.shape).toBe('star');
    expect(c.props?.points).toBe(5);
  });

  it('画一个椭圆 → ellipse（不被“圆”误判为 circle）', () => {
    const c = first('画一个椭圆') as CreateCommand;
    expect(c.shape).toBe('ellipse');
  });

  it('画一个六边形 → polygon，sides=6，且不被当作 6 个', () => {
    const c = first('画一个六边形') as CreateCommand;
    expect(c.shape).toBe('polygon');
    expect(c.props?.sides).toBe(6);
    expect(c.count).toBeUndefined();
  });

  it('画一个半圆 → arc', () => {
    const c = first('画一个半圆') as CreateCommand;
    expect(c.shape).toBe('arc');
  });

  it('画一个爱心 → heart', () => {
    const c = first('画一个爱心') as CreateCommand;
    expect(c.shape).toBe('heart');
  });
});

describe('组合/语义绘图', () => {
  it('画一个笑脸 → compose face', () => {
    const c = first('画一个笑脸') as { op: string; preset: string };
    expect(c.op).toBe('compose');
    expect(c.preset).toBe('face');
  });

  it('在右上角画一个大房子 → compose house + 方位 + 尺寸', () => {
    const c = first('在右上角画一个大房子') as { op: string; preset: string; props: { position?: string; sizeScale?: number } };
    expect(c.op).toBe('compose');
    expect(c.preset).toBe('house');
    expect(c.props.position).toBe('top-right');
    expect(c.props.sizeScale).toBeGreaterThan(1);
  });

  it('画一朵红色的花 → compose flower 且主色透传', () => {
    const c = first('画一朵红色的花') as { op: string; preset: string; props: { color?: string } };
    expect(c.op).toBe('compose');
    expect(c.preset).toBe('flower');
    expect(resolveColor(c.props.color)).toBe('#e23b3b');
  });

  it('选中房子 → select group house', () => {
    const c = first('选中房子');
    expect(c).toEqual({ op: 'select', target: { kind: 'group', preset: 'house' } });
  });

  it('把笑脸放大 → scale，目标为 group face', () => {
    const c = first('把笑脸放大') as { op: string; target: unknown };
    expect(c.op).toBe('scale');
    expect(c.target).toEqual({ kind: 'group', preset: 'face' });
  });
});

describe('修改/变换类指令', () => {
  it('把它变成绿色 → recolor last', () => {
    const c = first('把它变成绿色') as { op: string; color: string; target: unknown };
    expect(c.op).toBe('recolor');
    expect(resolveColor(c.color)).toBe('#2fae5a');
    expect(c.target).toEqual({ kind: 'last' });
  });

  it('放大一点 → scale 软系数', () => {
    const c = first('放大一点');
    expect(c.op).toBe('scale');
    expect((c as { factor: number }).factor).toBeCloseTo(1.25);
  });

  it('删除最后一个', () => {
    const c = first('删除最后一个');
    expect(c).toEqual({ op: 'delete', target: { kind: 'last' } });
  });

  it('向右移动100像素', () => {
    const c = first('向右移动100像素');
    expect(c).toMatchObject({ op: 'move', direction: 'right', distance: 100 });
  });

  it('把所有圆形变成黄色 → byType? byColor 优先 all', () => {
    const c = first('把所有圆形变成黄色');
    expect(c.op).toBe('recolor');
    expect((c as { target: unknown }).target).toEqual({ kind: 'all' });
  });
});

describe('口语样式与更多颜色', () => {
  it('把它变粗 → style strokeWidth, 目标 last', () => {
    const c = first('把它变粗') as { op: string; strokeWidth: number; target: unknown };
    expect(c.op).toBe('style');
    expect(c.strokeWidth).toBeGreaterThanOrEqual(6);
    expect(c.target).toEqual({ kind: 'last' });
  });

  it('改成空心 → style fill=false', () => {
    const c = first('改成空心') as { op: string; fill: boolean };
    expect(c.op).toBe('style');
    expect(c.fill).toBe(false);
  });

  it('变成实心 → style fill=true', () => {
    const c = first('变成实心') as { op: string; fill: boolean };
    expect(c.op).toBe('style');
    expect(c.fill).toBe(true);
  });

  it('“把它变小”仍是缩放而非样式', () => {
    expect(first('把它变小').op).toBe('scale');
  });

  it('具体色不被短色词遮蔽：深蓝/草绿/玫红', () => {
    const a = first('画一个深蓝色的圆') as CreateCommand;
    expect(resolveColor(a.props?.color)).toBe('#1f4fa8');
    const b = first('画一个草绿色的方块') as CreateCommand;
    expect(resolveColor(b.props?.color)).toBe('#5cb85c');
    const c = first('画一个玫红色的圆') as CreateCommand;
    expect(resolveColor(c.props?.color)).toBe('#e23b7a');
  });
});

describe('全局指令', () => {
  it('撤销 / 重做 / 清空 / 导出', () => {
    expect(first('撤销')).toEqual({ op: 'undo' });
    expect(first('重做')).toEqual({ op: 'redo' });
    expect(first('清空画布')).toEqual({ op: 'clear' });
    expect(first('保存图片')).toEqual({ op: 'export' });
  });

  it('全选', () => {
    expect(first('全选')).toEqual({ op: 'select', target: { kind: 'all' } });
  });
});

describe('复杂指令拆解 / 容错', () => {
  it('一句多命令：画一个圆然后写标题', () => {
    const r = parseWithRules('画一个圆然后写标题');
    expect(r.matched).toBe(true);
    expect(r.commands).toHaveLength(2);
    expect(r.commands[0]).toMatchObject({ op: 'create', shape: 'circle' });
    expect(r.commands[1]).toMatchObject({ op: 'create', shape: 'text' });
  });

  it('无法识别 → matched=false 且产出 unknown', () => {
    const r = parseWithRules('今天天气真不错啊');
    expect(r.matched).toBe(false);
    expect(r.commands[0].op).toBe('unknown');
  });

  it('部分命中也判定为未完全匹配', () => {
    const r = parseWithRules('画一个圆然后随便干点什么别的事情');
    expect(r.matched).toBe(false);
  });

  it('空间口语：均匀分布映射为横向排布，旁边映射为右侧方位', () => {
    const row = first('画四个圆均匀分布');
    expect(row).toMatchObject({ op: 'create', shape: 'circle', count: 4, layout: 'row' });
    const side = first('在旁边画一个方块');
    expect(side).toMatchObject({ op: 'create', shape: 'rect', props: { position: 'right' } });
  });
});

describe('AI 文生图回归', () => {
  it('熊猫不命中小猫预设，改走 imagine', () => {
    expect(first('画一只熊猫')).toMatchObject({ op: 'imagine', prompt: '熊猫' });
  });

  it('芒果这类无规则物体走 imagine', () => {
    expect(first('画一个芒果')).toMatchObject({ op: 'imagine', prompt: '芒果' });
  });

  it('小猫仍走组合预设', () => {
    expect(first('画一只小猫')).toMatchObject({ op: 'compose', preset: 'cat' });
  });
});
