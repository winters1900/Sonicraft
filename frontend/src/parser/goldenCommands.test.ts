import { describe, expect, it } from 'vitest';
import { parseWithRules } from './RuleParser';
import { matchVoiceControl } from '../voice/voiceControl';

const colors = ['红色', '蓝色', '绿色', '黄色', '深蓝', '草绿', '玫红', '紫色', '黑色', '白色'];
const shapes = [
  ['圆', 'circle'],
  ['方块', 'rect'],
  ['三角形', 'triangle'],
  ['五角星', 'star'],
  ['椭圆', 'ellipse'],
  ['六边形', 'polygon'],
  ['爱心', 'heart'],
  ['半圆', 'arc'],
] as const;

const createCases = colors.flatMap((color) => (
  shapes.map(([spoken, shape]) => ({ text: `画一个${color}的${spoken}`, op: 'create', shape }))
));

const fixedCases = [
  { text: '画四个圆均匀分布', op: 'create', shape: 'circle' },
  { text: '画三个蓝色方块排成一列', op: 'create', shape: 'rect' },
  { text: '在旁边画一个方块', op: 'create', shape: 'rect' },
  { text: '写标题你好', op: 'create', shape: 'text' },
  { text: '画一个笑脸', op: 'compose', preset: 'face' },
  { text: '画一个房子', op: 'compose', preset: 'house' },
  { text: '画个太阳', op: 'compose', preset: 'sun' },
  { text: '画一棵树', op: 'compose', preset: 'tree' },
  { text: '画一朵花', op: 'compose', preset: 'flower' },
  { text: '画一个雪人', op: 'compose', preset: 'snowman' },
  { text: '画一只小猫', op: 'compose', preset: 'cat' },
  { text: '画一只熊猫', op: 'imagine' },
  { text: '画一个芒果', op: 'imagine' },
  { text: '画一只老虎', op: 'imagine' },
  { text: '把它变成绿色', op: 'recolor' },
  { text: '改成实心', op: 'style' },
  { text: '改成空心', op: 'style' },
  { text: '放大一点', op: 'scale' },
  { text: '缩小', op: 'scale' },
  { text: '向右移动100像素', op: 'move' },
  { text: '旋转45度', op: 'rotate' },
  { text: '选中所有三角形', op: 'select' },
  { text: '删除最后一个', op: 'delete' },
  { text: '撤销', op: 'undo' },
  { text: '重做', op: 'redo' },
  { text: '清空画布', op: 'clear' },
  { text: '保存图片', op: 'export' },
] as const;

const voiceControlCases = [
  '开始聆听',
  '停止聆听',
  '打开帮助',
  '关闭帮助',
];

describe('中文语音黄金集', () => {
  it('覆盖至少 100 条口语绘图指令', () => {
    const cases = [...createCases, ...fixedCases];
    expect(cases.length + voiceControlCases.length).toBeGreaterThanOrEqual(100);
    for (const item of cases) {
      const { text, ...expected } = item;
      const parsed = parseWithRules(item.text);
      expect(parsed.matched, text).toBe(true);
      expect(parsed.commands[0]).toMatchObject(expected);
    }
  });

  it('覆盖应用级语音控制口令', () => {
    for (const text of voiceControlCases) {
      expect(matchVoiceControl(text), text).not.toBeNull();
    }
  });
});
