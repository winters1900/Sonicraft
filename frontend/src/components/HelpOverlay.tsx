interface Props {
  onClose: () => void;
}

const GROUPS: { title: string; items: string[] }[] = [
  {
    title: '创建图形',
    items: ['画一个红色的圆', '画三个蓝色的方块排成一行', '在左上角画个大三角形', '画一个五角星', '写标题“你好”'],
  },
  {
    title: '任意物体',
    items: ['画一只熊猫', '画一个芒果', '在右上角画一座雪山', '画一辆红色小汽车'],
  },
  {
    title: '组合图形',
    items: ['画一个笑脸', '画一座房子', '在右上角画个太阳', '画一棵树', '画一朵红色的花', '画一只小猫'],
  },
  {
    title: '调整样式',
    items: ['把它变成绿色', '改成实心', '把所有圆变成黄色'],
  },
  {
    title: '变换图形',
    items: ['放大一点', '缩小', '向右移动100像素', '旋转45度', '选中所有三角形'],
  },
  {
    title: '语音控制',
    items: ['停止聆听', '开始聆听', '切到 Whisper 识别', '切到浏览器识别', '打开帮助', '关闭反馈'],
  },
];

export function HelpOverlay({ onClose }: Props) {
  return (
    <div className="help" onClick={onClose}>
      <div className="help__panel" onClick={(e) => e.stopPropagation()}>
        <div className="help__head">
          <h2>你可以这样说</h2>
          <button onClick={onClose}>关闭</button>
        </div>
        <p className="help__sub">
          高频几何指令走本地规则；任意物体走 Hugging Face 文生图并放入画布。
        </p>
        <div className="help__grid">
          {GROUPS.map((g) => (
            <div key={g.title} className="help__group">
              <h3>{g.title}</h3>
              <ul>
                {g.items.map((it) => (
                  <li key={it}>{it}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
