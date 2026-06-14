// RuleParser —— 本地规则快路径。
// 用正则/关键词把高频中文绘图指令直接解析为 DrawCommand[]，无需网络（<1ms）。
// 命中则跳过 LLM；未命中(matched=false)由 CommandRouter 兜底转交 LLM。

import { COLOR_KEYWORDS } from '@shared/colors';
import type {
  DrawCommand,
  Layout,
  PositionHint,
  SelectTarget,
  ShapeName,
} from '@shared/commands';

export interface RuleParseResult {
  commands: DrawCommand[];
  /** 是否全部段落都被规则可靠命中。false 时建议 fallback 到 LLM。 */
  matched: boolean;
}

// —— 关键词表 ——
// 顺序很重要：椭圆/半圆都含“圆”、五边形含“五”，必须放在“圆”之前优先命中。
const SHAPE_PATTERNS: Array<{ re: RegExp; shape: ShapeName }> = [
  { re: /五角星|星星|星形|star/i, shape: 'star' },
  { re: /椭圆|oval|ellipse/i, shape: 'ellipse' },
  { re: /心形|爱心|桃心|heart/i, shape: 'heart' },
  { re: /多边形|[三四五六七八]边形|polygon/i, shape: 'polygon' },
  { re: /半圆|弧形|弧线|arc/i, shape: 'arc' },
  { re: /圆形|圆圈|圆|circle/i, shape: 'circle' },
  { re: /箭头|arrow/i, shape: 'arrow' },
  { re: /三角形|三角|triangle/i, shape: 'triangle' },
  { re: /矩形|长方形|正方形|方块|方形|rect|square/i, shape: 'rect' },
  { re: /直线|线条|线段|横线|竖线|line/i, shape: 'line' },
];

// 组合/语义绘图关键词 → 预设名。命中即整组展开（零延迟，无需 LLM）。
const PRESET_KEYWORDS: Array<{ re: RegExp; preset: string }> = [
  { re: /笑脸|微笑|笑容|人脸|脸/, preset: 'face' },
  { re: /房子|房屋|小屋|屋子/, preset: 'house' },
  { re: /太阳/, preset: 'sun' },
  { re: /雪人/, preset: 'snowman' },
  { re: /小猫|猫咪|(?<!熊)猫/, preset: 'cat' }, // 排除“熊猫”——交给 AI 文生图
  { re: /花朵|花儿|花/, preset: 'flower' },
  { re: /大树|树木|树/, preset: 'tree' },
];

const CN_NUM: Record<string, number> = {
  零: 0, 一: 1, 两: 2, 二: 2, 俩: 2, 三: 3, 四: 4, 五: 5,
  六: 6, 七: 7, 八: 8, 九: 9, 十: 10,
};

const CONNECTORS = /然后|接着|再|还有|和|，|,|。|；|;|、|\s+/;

// 口语填充词/纠错前缀，归一化时剥离以提升识别鲁棒性（容错）。
const LEADING_FILLERS = /^(那个|这个|嗯+|呃+|啊+|帮我|帮忙|请|麻烦|我想|我要|我希望|给我|能不能|可以|来)/;
const CORRECTION_MARKERS = /(不对|不是|错了|搞错了|说错了|重新|改一下)[，,、:：\s]*/g;

/** 规范化口语输入：去除填充词、纠错标记与句末标点，让规则匹配更稳。 */
export function normalizeInput(text: string): string {
  let t = text.trim().replace(CORRECTION_MARKERS, '');
  let prev: string;
  do {
    prev = t;
    t = t.replace(/^[，,、。：:\s]+/, '').replace(LEADING_FILLERS, '').trim();
  } while (t !== prev && t.length);
  return t.replace(/[。.!！~～]+$/g, '').trim();
}

/** 解析整句：先归一化，再按连接词拆段，每段独立解析，合并命令。 */
export function parseWithRules(input: string): RuleParseResult {
  const text = normalizeInput(input);
  if (!text) return { commands: [], matched: false };

  const segments = text.split(CONNECTORS).map((s) => s.trim()).filter(Boolean);
  const commands: DrawCommand[] = [];
  let allMatched = true;

  for (const seg of segments) {
    const cmd = parseSegment(seg);
    if (cmd) {
      commands.push(cmd);
    } else {
      allMatched = false;
      commands.push({ op: 'unknown', raw: seg });
    }
  }

  // 整句无任何连接词且没解析出来时，matched=false 触发 LLM
  return { commands, matched: allMatched && commands.length > 0 };
}

function parseSegment(seg: string): DrawCommand | null {
  return (
    matchGlobal(seg) ??
    matchDelete(seg) ??
    matchRecolor(seg) ??
    matchStyle(seg) ??
    matchScale(seg) ??
    matchRotate(seg) ??
    matchMove(seg) ??
    matchSelect(seg) ??
    matchCreate(seg) ??
    null
  );
}

// —— 全局命令 ——
function matchGlobal(seg: string): DrawCommand | null {
  if (/撤销|撤回|回退|后退|上一步/.test(seg)) return { op: 'undo' };
  if (/重做|恢复|前进/.test(seg)) return { op: 'redo' };
  if (/清空|清屏|清除|全部删除|删光|重置|重来/.test(seg)) return { op: 'clear' };
  if (/导出|保存|下载图片|另存/.test(seg)) return { op: 'export' };
  if (/全选|选中全部|选所有/.test(seg)) return { op: 'select', target: { kind: 'all' } };
  return null;
}

// —— 删除 ——
function matchDelete(seg: string): DrawCommand | null {
  if (!/删除|删掉|去掉|移除|擦掉/.test(seg)) return null;
  return { op: 'delete', target: detectTarget(seg) };
}

// —— 改色 ——
function matchRecolor(seg: string): DrawCommand | null {
  const hasVerb = /变|改|换|涂|染|设为|设成/.test(seg);
  const color = findColor(seg);
  if (!hasVerb || !color) return null;
  return { op: 'recolor', color, target: detectTarget(seg) };
}

// —— 样式：口语线宽（粗/细）与填充切换（实心/空心），不含创建 ——
function matchStyle(seg: string): DrawCommand | null {
  if (/画|写/.test(seg)) return null; // “画一个实心圆”归创建，由 matchCreate 处理
  let strokeWidth: number | undefined;
  if (/粗/.test(seg)) strokeWidth = /很|特别|最|超|更/.test(seg) ? 10 : 6;
  else if (/细/.test(seg)) strokeWidth = /很|特别|最|超|更/.test(seg) ? 1 : 2;
  let fill: boolean | undefined;
  if (/实心|填满|涂满|填充/.test(seg)) fill = true;
  else if (/空心|镂空/.test(seg)) fill = false;
  if (strokeWidth == null && fill == null) return null;
  return {
    op: 'style',
    target: detectTarget(seg),
    ...(strokeWidth != null ? { strokeWidth } : {}),
    ...(fill != null ? { fill } : {}),
  };
}

// —— 缩放 ——
function matchScale(seg: string): DrawCommand | null {
  // “两倍/2倍”优先
  const times = seg.match(/(\d+(?:\.\d+)?|[一两二三四五])\s*倍/);
  if (times && /放大|变大|扩大|大/.test(seg)) {
    const f = parseNum(times[1]);
    if (f) return { op: 'scale', factor: f, target: detectTarget(seg) };
  }
  if (/放大|变大|扩大|大一点|大一些|大点|再大/.test(seg)) {
    const soft = /一点|一些|点/.test(seg);
    return { op: 'scale', factor: soft ? 1.25 : 1.5, target: detectTarget(seg) };
  }
  if (/缩小|变小|小一点|小一些|小点|再小/.test(seg)) {
    const soft = /一点|一些|点/.test(seg);
    return { op: 'scale', factor: soft ? 0.8 : 0.6, target: detectTarget(seg) };
  }
  return null;
}

// —— 旋转 ——
function matchRotate(seg: string): DrawCommand | null {
  if (!/旋转|转动|转/.test(seg)) return null;
  const m = seg.match(/(\d+)\s*度/);
  let deg = m ? Number(m[1]) : 45;
  if (/逆时针|向左转/.test(seg)) deg = -deg;
  return { op: 'rotate', deg, target: detectTarget(seg) };
}

// —— 移动 ——
function matchMove(seg: string): DrawCommand | null {
  if (!/移动|移到|挪|往|向(?:左|右|上|下)/.test(seg)) return null;
  const dist = seg.match(/(\d+)\s*(?:像素|px|点)?/);
  const distance = dist ? Number(dist[1]) : undefined;
  let direction: 'up' | 'down' | 'left' | 'right' | undefined;
  if (/左/.test(seg)) direction = 'left';
  else if (/右/.test(seg)) direction = 'right';
  else if (/上/.test(seg)) direction = 'up';
  else if (/下/.test(seg)) direction = 'down';
  if (!direction) return null;
  return { op: 'move', direction, distance, target: detectTarget(seg) };
}

// —— 选择 ——
function matchSelect(seg: string): DrawCommand | null {
  if (!/选中|选择|选|框选/.test(seg)) return null;
  return { op: 'select', target: detectTarget(seg) ?? { kind: 'last' } };
}

// —— 创建 ——
function matchCreate(seg: string): DrawCommand | null {
  // 文字优先：含“写/文字/标题”
  if (/写|文字|文本|标题|字/.test(seg) && !hasShape(seg, 'exceptText')) {
    return buildText(seg);
  }

  // 组合/语义绘图优先：命中“笑脸/房子/太阳…”整组展开（但 star/heart 等已是基础形状，不在此表）
  const preset = findPreset(seg);
  if (preset) {
    const cp: { position?: PositionHint; sizeScale?: number; color?: string } = {};
    const pos = findPosition(seg);
    const sz = findSize(seg);
    const col = findColor(seg);
    if (pos) cp.position = pos;
    if (sz) cp.sizeScale = sz;
    if (col) cp.color = col;
    return { op: 'compose', preset, props: cp };
  }

  const shape = findShape(seg);
  if (!shape) {
    // 既不是基础图形也不是预设：若有绘制意图+具体物体，交给 AI 文生图（画熊猫/芒果/星空…）
    return buildImagine(seg);
  }

  const count = findCount(seg);
  const color = findColor(seg);
  const sizeScale = findSize(seg);
  const layout = findLayout(seg);
  const position = findPosition(seg);
  const fill = findFill(seg);

  const p: {
    color?: string; sizeScale?: number; position?: PositionHint; fill?: boolean; sides?: number; points?: number;
  } = {};
  if (color) p.color = color;
  if (sizeScale) p.sizeScale = sizeScale;
  if (position) p.position = position;
  if (fill != null) p.fill = fill;
  if (shape === 'polygon') {
    const sides = findSides(seg);
    if (sides) p.sides = sides;
  }
  if (shape === 'star') {
    const pts = findStarPoints(seg);
    if (pts) p.points = pts;
  }

  // findCount 需带量词（个/条…）才计数，故“五边形/六角星”里的数字不会被误当数量。
  return {
    op: 'create',
    shape,
    ...(count > 1 ? { count } : {}),
    ...(count > 1 && layout ? { layout } : count > 1 ? { layout: 'row' as Layout } : {}),
    props: p,
  };
}

function findPreset(seg: string): string | null {
  for (const { re, preset } of PRESET_KEYWORDS) if (re.test(seg)) return preset;
  return null;
}

/** 非图形/预设但有绘制意图 → AI 文生图。提取物体短语作为提示词。 */
function buildImagine(seg: string): DrawCommand | null {
  if (!/画|绘|生成|做一?[个张幅只]|来一?[个张幅只]/.test(seg)) return null; // 必须有绘制意图
  const position = findPosition(seg);
  const sizeScale = findSize(seg);
  const prompt = seg
    .replace(/(画出来|画一下|画|绘制|绘|生成|做|来)/g, '')
    .replace(/[一二两三四五六七八九十\d]+\s*(个|只|张|幅|条|匹|头|朵|棵|片|辆|架|杯|座|位)/g, '')
    .replace(/^(一)?(个|只|张|幅|条|匹|头|朵|棵|片|辆|架|杯|座|位)/, '')
    .replace(/(左上角|右上角|左下角|右下角|左上|右上|左下|右下|上面|上方|顶部|下面|下方|底部|左边|左侧|右边|右侧|中间|中央|正中|居中)/g, '')
    .replace(/的?(图片|图像|照片|图)$/g, '')
    .replace(/[，,。.!！?？、]/g, '')
    .trim();
  if (prompt.length < 1 || prompt.length > 24) return null;
  const props: { position?: PositionHint; sizeScale?: number } = {};
  if (position) props.position = position;
  if (sizeScale) props.sizeScale = sizeScale;
  return { op: 'imagine', prompt, props };
}

function buildText(seg: string): DrawCommand {
  // 提取引号内或“写”之后的内容作为文字
  const quoted = seg.match(/["“'']([^"”'']+)["”'']/);
  let content = quoted?.[1];
  if (!content) {
    const after = seg.match(/写(?:上|个|一个)?\s*(.+)$/);
    content = after?.[1];
  }
  content = (content ?? '文字').trim() || '文字';
  const color = findColor(seg);
  const sizeScale = findSize(seg);
  const position = findPosition(seg);
  return {
    op: 'create',
    shape: 'text',
    props: {
      text: content,
      ...(color ? { color } : {}),
      ...(sizeScale ? { sizeScale } : {}),
      ...(position ? { position } : {}),
    },
  };
}

// —— 字段提取辅助 ——
function findShape(seg: string): ShapeName | null {
  for (const { re, shape } of SHAPE_PATTERNS) if (re.test(seg)) return shape;
  return null;
}

function hasShape(seg: string, mode?: 'exceptText'): boolean {
  const found = findShape(seg);
  if (mode === 'exceptText') return found != null;
  return found != null;
}

function findCount(seg: string): number {
  const digit = seg.match(/(\d+)\s*(?:个|条|只|根|份|块)?/);
  if (digit && /个|条|只|根|份|块|\d/.test(seg)) {
    const n = Number(digit[1]);
    if (n >= 1 && n <= 50) return n;
  }
  const cn = seg.match(/([零一两二俩三四五六七八九十])\s*(?:个|条|只|根|份|块)/);
  if (cn) return CN_NUM[cn[1]] ?? 1;
  return 1;
}

// 返回匹配到的颜色「词」（而非 hex）。DSL 携带语义颜色，由执行器在落地时归一化，
// 这样反馈文案可读（“红色”而非“#e23b3b”），也兼容 LLM 直接输出的中文色名。
function findColor(seg: string): string | undefined {
  // 取最长匹配；长度相同时偏好非“色”后缀的具体色（草绿 > 绿色、深蓝 > 蓝色）。
  let best: string | undefined;
  for (const kw of COLOR_KEYWORDS) {
    if (!seg.includes(kw)) continue;
    if (
      !best ||
      kw.length > best.length ||
      (kw.length === best.length && best.endsWith('色') && !kw.endsWith('色'))
    ) {
      best = kw;
    }
  }
  if (best) return best;
  const en = seg.match(/\b(red|blue|green|yellow|orange|purple|black|white|gray|grey|pink|cyan|brown)\b/i);
  if (en) return en[1].toLowerCase();
  const hex = seg.match(/#[0-9a-f]{3,6}/i);
  if (hex) return hex[0];
  return undefined;
}

/** 多边形边数：“五边形”→5，“12边形”→12。无则 undefined（引擎用默认 6）。 */
function findSides(seg: string): number | undefined {
  const cn = seg.match(/([三四五六七八九十])\s*边形/);
  if (cn) return CN_NUM[cn[1]];
  const digit = seg.match(/(\d+)\s*边形/);
  if (digit) {
    const n = Number(digit[1]);
    if (n >= 3 && n <= 20) return n;
  }
  return undefined;
}

/** 星形角数：“六角星”→6。默认五角（undefined → 引擎用 5）。 */
function findStarPoints(seg: string): number | undefined {
  const cn = seg.match(/([三四五六七八九十])\s*角星/);
  if (cn) return CN_NUM[cn[1]];
  const digit = seg.match(/(\d+)\s*角星/);
  if (digit) {
    const n = Number(digit[1]);
    if (n >= 3 && n <= 20) return n;
  }
  return undefined;
}

function findSize(seg: string): number | undefined {
  if (/大/.test(seg) && !/大概|大约/.test(seg)) return /一点|一些|点|稍/.test(seg) ? 1.3 : 1.6;
  if (/小/.test(seg)) return /一点|一些|点|稍/.test(seg) ? 0.8 : 0.55;
  if (/巨大|超大|特大/.test(seg)) return 2.2;
  return undefined;
}

function findLayout(seg: string): Layout | undefined {
  if (/一行|横排|横向|并排|排成一行|均匀分布|平均分布|均匀排列/.test(seg)) return 'row';
  if (/一列|竖排|纵向|排成一列/.test(seg)) return 'col';
  if (/网格|方阵|矩阵/.test(seg)) return 'grid';
  return undefined;
}

function findPosition(seg: string): PositionHint | undefined {
  if (/左上/.test(seg)) return 'top-left';
  if (/右上/.test(seg)) return 'top-right';
  if (/左下/.test(seg)) return 'bottom-left';
  if (/右下/.test(seg)) return 'bottom-right';
  if (/上面|上方|顶部|最上/.test(seg)) return 'top';
  if (/下面|下方|底部|最下/.test(seg)) return 'bottom';
  if (/左边|左侧|靠左/.test(seg)) return 'left';
  if (/右边|右侧|靠右|旁边|边上/.test(seg)) return 'right';
  if (/中间|中央|正中|居中/.test(seg)) return 'center';
  return undefined;
}

function findFill(seg: string): boolean | undefined {
  if (/实心|填充|涂满|填满/.test(seg)) return true;
  if (/空心|描边|镂空/.test(seg)) return false;
  return undefined;
}

/** 从片段中识别指代目标；无明确指代返回 undefined（执行器用当前选区）。 */
function detectTarget(seg: string): SelectTarget | undefined {
  if (/全部|所有|全都|一切/.test(seg)) return { kind: 'all' };
  if (/最后|刚才|刚画|上一个|这个|那个|它/.test(seg)) return { kind: 'last' };
  const idx = seg.match(/第\s*([零一两二三四五六七八九十\d]+)\s*个/);
  if (idx) {
    const n = /\d/.test(idx[1]) ? Number(idx[1]) : CN_NUM[idx[1]];
    if (n) return { kind: 'byIndex', index: n };
  }
  // 组合预设名整体指代：“把房子放大 / 选中笑脸”。
  const preset = findPreset(seg);
  if (preset) return { kind: 'group', preset };
  const shape = findShape(seg);
  const color = findColor(seg);
  if (color && (/的/.test(seg) || shape)) return { kind: 'byColor', color };
  if (shape) return { kind: 'byType', shape };
  return undefined;
}

function parseNum(s: string): number | undefined {
  if (/^\d/.test(s)) return Number(s);
  return CN_NUM[s];
}
