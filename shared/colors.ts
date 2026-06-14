// 颜色归一化 —— 前端规则解析、后端 LLM 输出与执行器共用一份色表。
// 支持中文色词、英文色名与直接的 #hex / rgb() 透传。

const COLOR_MAP: Record<string, string> = {
  红: '#e23b3b', 红色: '#e23b3b', 大红: '#e23b3b', 朱红: '#e23b3b',
  深红: '#b01f1f', 暗红: '#a01f2b', 酒红: '#7a1f2b', 橙红: '#e2542f',
  蓝: '#2f7be2', 蓝色: '#2f7be2', 天蓝: '#4aa3ff', 深蓝: '#1f4fa8',
  浅蓝: '#9ecbf0', 湖蓝: '#1f9bd1', 宝蓝: '#2552d6', 藏蓝: '#1b2a5b', 藏青: '#1b2a5b',
  绿: '#2fae5a', 绿色: '#2fae5a', 草绿: '#5cb85c', 深绿: '#1f7a3f',
  浅绿: '#a6e0b8', 墨绿: '#143d2b', 翠绿: '#1fbf6b', 嫩绿: '#9be15d', 青绿: '#10b9a0', 军绿: '#5a6a3a',
  黄: '#e2b32f', 黄色: '#e2b32f', 金色: '#d4af37', 金黄: '#f0b400', 浅黄: '#f3e89a', 米黄: '#f3e2a9', 杏色: '#f0c987',
  橙: '#e2812f', 橙色: '#e2812f', 橘色: '#e2812f', 橘黄: '#e2812f',
  紫: '#8a4fd4', 紫色: '#8a4fd4', 深紫: '#5b2a9b', 浅紫: '#b89be0', 淡紫: '#b89be0', 紫罗兰: '#8a4fd4',
  黑: '#222222', 黑色: '#222222',
  白: '#ffffff', 白色: '#ffffff', 米白: '#f5f0e1', 米色: '#e8dcc0',
  灰: '#888888', 灰色: '#888888', 深灰: '#555555', 浅灰: '#bbbbbb', 银灰: '#9aa0a6', 银色: '#c0c0c0', 银白: '#e8e8ec',
  粉: '#ed74b0', 粉色: '#ed74b0', 粉红: '#ed74b0', 粉红色: '#ed74b0', 浅粉: '#f7c0db',
  玫红: '#e23b7a', 玫瑰红: '#e23b7a', 桃红: '#f25a8b',
  青: '#27c4c4', 青色: '#27c4c4',
  棕: '#9b6a3a', 棕色: '#9b6a3a', 褐色: '#9b6a3a', 咖啡色: '#6f4e37', 卡其: '#b5a16a', 卡其色: '#b5a16a', 肤色: '#f3c6a5',
  red: '#e23b3b', blue: '#2f7be2', green: '#2fae5a', yellow: '#e2b32f',
  orange: '#e2812f', purple: '#8a4fd4', black: '#222222', white: '#ffffff',
  gray: '#888888', grey: '#888888', pink: '#ed74b0', cyan: '#27c4c4', brown: '#9b6a3a',
};

/** 把任意颜色描述归一化为 CSS 颜色字符串；无法识别返回 undefined。 */
export function resolveColor(input?: string): string | undefined {
  if (!input) return undefined;
  const raw = input.trim();
  if (/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(raw)) return raw;
  if (/^rgba?\(/i.test(raw)) return raw;
  if (COLOR_MAP[raw]) return COLOR_MAP[raw];
  const lower = raw.toLowerCase();
  if (COLOR_MAP[lower]) return COLOR_MAP[lower];
  return undefined;
}

/** 已知颜色中文名清单，供规则解析器做关键词匹配。
 *  按长度降序：确保“深蓝/草绿/粉红色”等具体色优先于“蓝/绿/粉”被命中，避免被短词遮蔽。 */
export const COLOR_KEYWORDS = Object.keys(COLOR_MAP)
  .filter((k) => /[一-龥]/.test(k))
  .sort((a, b) => b.length - a.length);
