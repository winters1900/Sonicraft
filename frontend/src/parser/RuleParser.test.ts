import { describe, expect, it } from 'vitest';
import { parseWithRules } from './RuleParser';
import { resolveColor } from '@shared/colors';
import type { CreateCommand } from '@shared/commands';

function first(text: string) {
  return parseWithRules(text).commands[0];
}

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
});
