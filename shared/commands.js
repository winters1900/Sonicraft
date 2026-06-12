// DrawCommand DSL —— 自然语言指令解析后的结构化中间表示。
// 规则解析器(本地)与 LLM 解析器(后端)都产出 DrawCommand[]，由 CommandExecutor 统一执行。
// 一句话可拆解为多条命令，这是“复杂指令拆解”的载体。
export const SHAPE_NAMES = ['circle', 'rect', 'line', 'arrow', 'triangle', 'text'];
/** 形状的中文显示名，用于语音/文字反馈。 */
export const SHAPE_LABEL = {
    circle: '圆形',
    rect: '矩形',
    line: '线条',
    arrow: '箭头',
    triangle: '三角形',
    text: '文字',
};
/** 轻量结构校验：过滤掉缺关键字段的非法命令，保证执行器输入可靠。 */
export function isValidCommand(c) {
    if (!c || typeof c !== 'object')
        return false;
    const op = c.op;
    switch (op) {
        case 'create':
            return SHAPE_NAMES.includes(c.shape);
        case 'recolor':
            return typeof c.color === 'string';
        case 'scale':
            return typeof c.factor === 'number';
        case 'rotate':
            return typeof c.deg === 'number';
        case 'select':
            return typeof c.target === 'object';
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
