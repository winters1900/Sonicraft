const TIP_LINES = [
  '试着开口说',
  '「画一个红色的圆」 · 「画一只熊猫」 · 「画一座房子」',
  '「把它变成绿色」 · 「放大一点」 · 「撤销」',
  '「开始聆听」 · 「打开帮助」 · 「保存图片」',
];

export function CanvasTips() {
  return (
    <div className="canvas-tips" aria-hidden>
      <div className="canvas-tips__inner">
        {TIP_LINES.map((line, i) => (
          <p key={i} className={i === 0 ? 'canvas-tips__lead' : undefined}>{line}</p>
        ))}
      </div>
    </div>
  );
}
